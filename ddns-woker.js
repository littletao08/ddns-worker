addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
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