export const json = (body, init={}) => {
  const headers = new Headers(init.headers || {});
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(JSON.stringify(body), {...init, headers});
};
export const methodNotAllowed = () => json({ok:false,error:'Method not allowed'}, {status:405});
