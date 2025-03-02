/**
 * DDNS Worker
 * 一个简单的 Cloudflare Worker，用于返回访问者的 IP 地址
 * 并支持自动更新DNS记录
 * 使用方式:
 * - 查询IP: https://ddns.example.com/
 * - 更新DNS: https://ddns.example.com/update?name=your_dns_record_name&key=your_access_key 
 * - name: 需要更新的DNS记录名称，全域名，不带https和最后/，如aaa.example.com
 */

// 验证是否为有效的IPv4地址
function isValidIPv4(ip) {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4Pattern.test(ip)) return false;
  
  const parts = ip.split('.').map(part => parseInt(part, 10));
  return parts.every(part => part >= 0 && part <= 255);
}

// 根据name获取对应的zone_id、api_token和access_key
function getConfigByName(name, env) {
  // 构建变量名
  const zoneIdVarName = `${name}__zone_id`;
  const apiTokenVarName = `${name}__api_token`;
  const accessKeyVarName = `${name}__access_key`;
  
  // 从环境变量中获取值
  const zoneId = env[zoneIdVarName];
  const apiToken = env[apiTokenVarName];
  const accessKey = env[accessKeyVarName];
  
  return { zoneId, apiToken, accessKey, recordName: name };
}

// 获取DNS记录当前IP
async function getDnsRecordCurrentIp(zoneId, recordName, apiToken) {
  if (!apiToken) {
    throw new Error(`未找到${recordName}对应的API令牌，确保name正确或${recordName}__api_token变量在worker中已设置`);
  }
  
  if (!zoneId) {
    throw new Error(`未找到${recordName}对应的Zone_ID，确保name正确或${recordName}__zone_id变量在worker中已设置`); 
  }
  
  if (!recordName) {
    throw new Error("需提供name参数");
  }
  
  try {
    // 列出DNS记录以获取当前IP
    // 使用正确的API端点，通过type和name参数过滤记录
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${recordName}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`获取DNS记录失败: ${JSON.stringify(data.errors)}`);
    }
    
    if (data.result && data.result.length > 0) {
      // 返回记录ID和当前IP
      return {
        recordId: data.result[0].id,
        currentIp: data.result[0].content
      };
    } else {
      throw new Error("未找到DNS记录");
    }
  } catch (error) {
    throw new Error(`查询DNS记录错误: ${error.message}`);
  }
}

// 更新DNS记录
async function updateDnsRecord(recordId, newIp, zoneId, recordName, apiToken) {
  if (!apiToken) {
    throw new Error(`缺少API令牌，请确保${recordName}__api_token环境变量已设置`);
  }
  
  if (!zoneId) {
    throw new Error(`缺少Zone ID，请确保${recordName}__zone_id环境变量已设置`);
  }
  
  if (!recordName) {
    throw new Error("缺少记录名称，请提供name参数");
  }
  
  if (!recordId) {
    throw new Error("缺少记录ID，无法更新DNS记录");
  }
  
  try {
    // 使用正确的API端点更新DNS记录
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'A',
          name: recordName,
          content: newIp,
          ttl: 300,
          proxied: true
        })
      }
    );
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`更新DNS记录失败: ${JSON.stringify(data.errors)}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(`更新DNS记录错误: ${error.message}`);
  }
}

export default {
  async fetch(request, env, ctx) {
    // 获取客户端IP地址
    const clientIP = request.headers.get('CF-Connecting-IP');
    
    // 获取请求URL和路径
    const url = new URL(request.url);
    
    // 检查是否是更新DNS的请求
    if (url.pathname === '/update') {
      try {
        // 验证客户端IP是否为有效的IPv4地址
        if (!isValidIPv4(clientIP)) {
          return new Response(JSON.stringify({
            success: false,
            message: `无效的IPv4地址: ${clientIP}`
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 获取URL参数
        const key = url.searchParams.get('key'); // 用于验证的访问密钥
        const recordName = url.searchParams.get('name');
        
        if (!recordName) {
          return new Response(JSON.stringify({
            success: false,
            message: "缺少name参数"
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 根据name获取配置
        const { zoneId, apiToken, accessKey } = getConfigByName(recordName, env);
        
        // 验证访问密钥
        if (accessKey && key !== accessKey) {
          return new Response(JSON.stringify({
            success: false,
            message: "无效的访问密钥"
          }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 获取当前DNS记录信息
        const { recordId, currentIp } = await getDnsRecordCurrentIp(zoneId, recordName, apiToken);
        
        // 比较当前IP和客户端IP
        if (currentIp === clientIP) {
          return new Response(JSON.stringify({
            success: true,
            updated: false,
            message: "DNS记录已是最新，无需更新",
            current_ip: currentIp
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 更新DNS记录
        const updateResult = await updateDnsRecord(recordId, clientIP, zoneId, recordName, apiToken);
        
        return new Response(JSON.stringify({
          success: true,
          updated: true,
          message: "DNS记录已更新",
          old_ip: currentIp,
          new_ip: clientIP
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          message: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // 原有逻辑：直接返回检测到的IP地址
    return new Response(clientIP, {
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache'
      }
    });
  }
}; 