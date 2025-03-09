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

// 验证是否为有效的IPv6地址
function isValidIPv6(ip) {
  // IPv6地址验证正则表达式
  const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Pattern.test(ip);
}

// 判断IP类型并返回对应的DNS记录类型
function getIpType(ip) {
  if (isValidIPv4(ip)) {
    return { valid: true, type: 'A' };
  } else if (isValidIPv6(ip)) {
    return { valid: true, type: 'AAAA' };
  } else {
    return { valid: false, type: null };
  }
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
async function getDnsRecordCurrentIp(zoneId, recordName, apiToken, recordType) {
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
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${recordType}&name=${recordName}`,
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
        currentIp: data.result[0].content,
        recordType: data.result[0].type
      };
    } else {
      throw new Error(`未找到${recordType}类型的DNS记录`);
    }
  } catch (error) {
    throw new Error(`查询DNS记录错误: ${error.message}`);
  }
}

// 更新DNS记录
async function updateDnsRecord(recordId, newIp, zoneId, recordName, apiToken, recordType) {
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
          type: recordType,
          name: recordName,
          content: newIp,
          ttl: 300
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
        // 验证客户端IP是否为有效的IP地址并获取类型
        const ipInfo = getIpType(clientIP);
        if (!ipInfo.valid) {
          return new Response(JSON.stringify({
            success: false,
            message: `无效的IP地址: ${clientIP}`
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
        const { recordId, currentIp, recordType } = await getDnsRecordCurrentIp(zoneId, recordName, apiToken, ipInfo.type);
        
        // 确保客户端IP类型与DNS记录类型匹配
        if (recordType !== ipInfo.type) {
          return new Response(JSON.stringify({
            success: false,
            message: `客户端IP类型(${ipInfo.type})与DNS记录类型(${recordType})不匹配`
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 比较当前IP和客户端IP
        if (currentIp === clientIP) {
          return new Response(JSON.stringify({
            success: true,
            updated: false,
            message: "DNS记录已是最新，无需更新",
            current_ip: currentIp,
            record_type: recordType
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // 更新DNS记录
        const updateResult = await updateDnsRecord(recordId, clientIP, zoneId, recordName, apiToken, recordType);
        
        return new Response(JSON.stringify({
          success: true,
          updated: true,
          message: "DNS记录已更新",
          old_ip: currentIp,
          new_ip: clientIP,
          record_type: recordType
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