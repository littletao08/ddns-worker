/**
 * DDNS Worker
 * 一个简单的 Cloudflare Worker，用于返回访问者的 IP 地址
 */

export default {
  async fetch(request, env, ctx) {
    // 获取客户端IP地址
    const clientIP = request.headers.get('CF-Connecting-IP');
    
    // 获取请求URL和路径
    const url = new URL(request.url);
    
    // 直接返回检测到的IP地址
    return new Response(clientIP, {
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache'
      }
    });
  }
}; 