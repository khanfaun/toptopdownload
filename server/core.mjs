const SITE = 'https://ssstiktok.dev/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
export class ServiceError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function normalizeInput(input) {
  let value = String(input || '').trim();
  if (value.startsWith('@')) value = `https://www.tiktok.com/${value}`;
  if (/^(www\.)?tiktok\.com\//.test(value)) value = `https://${value}`;
  let u; try { u = new URL(value); } catch { throw new ServiceError('Hãy nhập liên kết video hoặc trang cá nhân TikTok.'); }
  if (!['https:', 'http:'].includes(u.protocol) || !['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname) || u.username || u.password || u.port) throw new ServiceError('Hãy dùng liên kết đầy đủ từ tiktok.com.');
  const m = u.pathname.match(/^\/@([a-zA-Z0-9_.]{1,64})(?:\/video\/(\d{10,25}))?\/?$/);
  if (!m || !m[1].replaceAll('.', '')) throw new ServiceError('Liên kết chưa đúng. Ví dụ: tiktok.com/@ten_tai_khoan');
  return {username:m[1], id:m[2] || null, type:m[2]?'video':'profile', url:`https://www.tiktok.com/@${m[1]}${m[2]?`/video/${m[2]}`:''}`};
}
export function decodeHTML(text='') {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all,key)=> {
    const common={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
    if(key[0]!=='#')return common[key.toLowerCase()]||all;
    const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
    return n>0 && n<=0x10ffff?String.fromCodePoint(n):'�';
  });
}
function attrs(tag) {
  const a={}; for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) a[m[1].toLowerCase()]=decodeHTML(m[2]??m[3]??m[4]); return a;
}
export function parseHTML(html, username) {
  const links=[], videos=[]; let anchor=null, title='', titleDepth=0, heading=false, headingText='', thumbnail='', detailThumbnail='';
  for(const token of html.match(/<[^>]*>|[^<]+/g)||[]) {
    if(token[0]!=='<') {const text=decodeHTML(token); if(anchor)anchor.label+=text;if(titleDepth)title+=text;if(heading)headingText+=text;continue;}
    const closing=/^<\//.test(token); const tag=token.match(/^<\/?\s*([\w-]+)/)?.[1]?.toLowerCase(); const a=closing?{}:attrs(token); const classes=(a.class||'').split(/\s+/);
    if(tag==='div'&&!closing&&classes.includes('video-item')) {thumbnail='';title='';}
    if(tag==='img'&&!closing&&a.src?.startsWith('https://')) {thumbnail=a.src;if(!detailThumbnail)detailThumbnail=a.src;}
    if(tag==='p'&&!closing&&classes.includes('text-title')) {title='';titleDepth=1;} else if(tag==='p'&&closing)titleDepth=0;
    if(tag==='h3') heading=!closing;
    if(tag==='a'&&!closing) {
      anchor={href:a.href||'',label:''};
      const id=a['data-name']?.match(/^SSSTikTok\.dev_(\d{10,25})\.mp4$/)?.[1];
      if(classes.includes('pro-dl-link')&&id)videos.push({id,username,title:title.trim(),thumbnail:safeThumbnail(thumbnail),url:`https://www.tiktok.com/@${username}/video/${id}`});
    }
    if(tag==='a'&&closing&&anchor) {links.push(anchor);anchor=null;}
  }
  return {links,videos:[...new Map(videos.map(v=>[v.id,v])).values()],title:headingText.trim(),thumbnail:safeThumbnail(detailThumbnail)};
}
export function safeThumbnail(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','tiktok.com','byteoversea.com','ibytedtos.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:'';} catch{return '';}
}
export function getHDLink(html,username) {
  const parsed=parseHTML(html,username);
  const link=parsed.links.find(l=>l.label.replace(/\s+/g,' ').trim().toLowerCase()==='download mp4 hd');
  if(!link)throw new ServiceError('Video này chưa có bản chất lượng cao. Không tải bản thấp hơn.',422);
  let u;try{u=new URL(link.href);}catch{throw new ServiceError('Liên kết chất lượng cao không hợp lệ.',502);}
  if(u.protocol!=='https:'||u.hostname!=='pro.snapcdn.app'||u.pathname!=='/dl'||u.username||u.password||u.port)throw new ServiceError('Nguồn chất lượng cao đã thay đổi. Hãy thử lại sau.',502);
  return {...parsed,hd:u.href};
}
function allowedMediaURL(value) {
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='pro.snapcdn.app'||u.hostname.endsWith('.tokcdn.com'));
}
export function validateMedia(response,id) {
  const u=new URL(response.url);
  const filename=`SSSTikTok.dev_${id}_hd.mp4`;
  const disposition=response.headers.get('content-disposition')||'';
  const named=disposition.match(/filename\*?\s*=\s*(?:UTF-8''|")?([^";]+)/i)?.[1];
  if(!allowedMediaURL(u.href)||!u.hostname.endsWith('.tokcdn.com')||decodeURIComponent(u.pathname.split('/').at(-1))!==`${id}_original.mp4`)throw new ServiceError('Dịch vụ không trả đúng bản video chất lượng cao.',502);
  if(u.searchParams.get('filename')!==filename && (!named||decodeURIComponent(named.trim())!==filename))throw new ServiceError('Không xác nhận được tên file chất lượng cao.',502);
  if(named&&decodeURIComponent(named.trim())!==filename)throw new ServiceError('Tên file chất lượng cao không khớp.',502);
  if(/text\/|json/i.test(response.headers.get('content-type')||''))throw new ServiceError('Dịch vụ trả trang lỗi thay vì video.',502);
  return filename;
}
async function timedFetch(fetcher,url,options={}) {
  const timer=new AbortController();const timeout=setTimeout(()=>timer.abort(),30000);
  const signal=options.signal?AbortSignal.any([options.signal,timer.signal]):timer.signal;
  try{return await fetcher(url,{...options,signal});}finally{clearTimeout(timeout);}
}
export async function search(input,cursor='0',page=0,fetcher=fetch,signal) {
  const data=new URLSearchParams({q:input.url,cursor:String(cursor),page:String(page),lang:'en'});
  const response=await timedFetch(fetcher,SITE+'api/ajaxSearch',{method:'POST',headers:{'user-agent':UA,referer:SITE,origin:SITE,'content-type':'application/x-www-form-urlencoded'},body:data,signal});
  if(!response.ok)throw new ServiceError('Dịch vụ đang bận. Hãy thử lại sau.',502);
  const raw=await response.text();if(raw.length>2500000)throw new ServiceError('Danh sách trả về quá lớn.',502);
  let result;try{result=JSON.parse(raw);}catch{throw new ServiceError('Dịch vụ trả dữ liệu chưa đọc được.',502);}
  if(input.type==='profile'&&result.status==='ok'&&Number(result.statusCode)===404)return {pageType:'profile',data:'',next_cursor:null};
  if(result.status!=='ok'||typeof result.data!=='string')throw new ServiceError('Chưa tìm được video. Kiểm tra liên kết hoặc thử lại sau.',422);
  return result;
}
export async function findVideos(value,cursor='0',page=0,fetcher=fetch,signal) {
  const input=normalizeInput(value); const result=await search(input,cursor,page,fetcher,signal);
  if(input.type==='video') {if(result.pageType!=='detail')throw new ServiceError('Không đọc được video này.',422);const parsed=getHDLink(result.data,input.username);return {type:'video',username:input.username,videos:[{id:input.id,username:input.username,url:input.url,title:parsed.title,thumbnail:parsed.thumbnail}],nextCursor:null};}
  if(result.pageType!=='profile')throw new ServiceError('Không đọc được trang cá nhân này.',422);
  const parsed=parseHTML(result.data,input.username); const next=result.next_cursor;
  if(!parsed.videos.length&&Number(page)===0)throw new ServiceError('Không tìm thấy video công khai trong tài khoản này.',404);
  const nextCursor=parsed.videos.length&&next&&String(next)!=='0'?String(next):null;
  if(nextCursor===String(cursor))throw new ServiceError('Dịch vụ lặp lại một trang. Hãy thử lại sau.',502);
  return {type:'profile',username:input.username,videos:parsed.videos,nextCursor};
}
export async function openHD(value,fetcher=fetch,signal) {
  const input=normalizeInput(value);if(!input.id)throw new ServiceError('Cần một liên kết video để tải.');
  const result=await search(input,'0',0,fetcher,signal);if(result.pageType!=='detail')throw new ServiceError('Không đọc được bản chất lượng cao.',422);
  let url=getHDLink(result.data,input.username).hd;
  for(let redirects=0;redirects<7;redirects++) {
    if(!allowedMediaURL(url))throw new ServiceError('Đường dẫn tải không được hỗ trợ.',502);
    const response=await timedFetch(fetcher,url,{headers:{'user-agent':UA,referer:SITE,'accept-encoding':'identity'},redirect:'manual',signal});
    if([301,302,303,307,308].includes(response.status)) {const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new ServiceError('Thiếu đường dẫn chuyển tiếp.',502);url=new URL(location,url).href;continue;}
    if(response.status!==200){await response.body?.cancel();throw new ServiceError('Nguồn video tạm thời chưa tải được. Thử lại sau.',502);}
    try {const filename=validateMedia(response,input.id);return {response,filename};} catch(error){await response.body?.cancel();throw error;}
  }
  throw new ServiceError('Dịch vụ chuyển tiếp quá nhiều lần.',502);
}
export async function handleApi(request,{fetcher=fetch}={}) {
  const u=new URL(request.url);
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
  try {
    const origin=request.headers.get('origin');
    if(origin&&origin!==u.origin)throw new ServiceError('Yêu cầu phải xuất phát từ trang web này.',403);
    if(request.headers.get('sec-fetch-site')==='cross-site')throw new ServiceError('Yêu cầu tải phải mở từ trang này.',403);
    if(u.pathname==='/api/search'&&request.method==='POST') {
      if(Number(request.headers.get('content-length'))>4096)throw new ServiceError('Liên kết quá dài.',413);
      const body=await request.text();if(body.length>4096)throw new ServiceError('Liên kết quá dài.',413);
      const data=JSON.parse(body);const page=Number(data.page||0),cursor=String(data.cursor??'0');
      if(!Number.isInteger(page)||page<0||page>10000||!/^\d{1,30}$/.test(cursor))throw new ServiceError('Trang yêu cầu không hợp lệ.');
      return Response.json(await findVideos(data.url,cursor,page,fetcher,request.signal),{headers});
    }
    if(u.pathname==='/api/download'&&request.method==='GET') {
      if((u.searchParams.get('url')||'').length>1000)throw new ServiceError('Liên kết quá dài.');
      const {response,filename}=await openHD(u.searchParams.get('url'),fetcher,request.signal);
      const outgoing=new Headers({...headers,'content-type':'video/mp4','content-disposition':`attachment; filename="${filename}"`,'x-video-quality':'original-hd'});
      const size=response.headers.get('content-length');if(size&&/^\d+$/.test(size))outgoing.set('content-length',size);
      // Forward the body without buffering it. Never proxy media via ordinary Functions.
      return new Response(response.body,{headers:outgoing});
    }
    return Response.json({error:'Không tìm thấy chức năng này.'},{status:404,headers});
  } catch(error) {
    if(request.signal.aborted) return new Response(null,{status:499});
    return Response.json({error:error instanceof ServiceError?error.message:'Kết nối tạm thời gián đoạn. Vui lòng thử lại.'},{status:error.status||502,headers});
  }
}
