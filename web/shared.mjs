export function videoKey(video){return `${video.username}/${video.id}`;}
export function summarize(job){return {total:job.length,done:job.filter(v=>v.status==='done'||v.status==='sent').length,failed:job.filter(v=>v.status==='failed').length};}
export function mergeQueue(existing,videos){const map=new Map(existing.map(item=>[videoKey(item.video),item]));for(const video of videos)if(!map.has(videoKey(video)))map.set(videoKey(video),{video,status:'pending'});return [...map.values()];}
export async function verifyMP4(file){
  if(file.size<24)throw new Error('Video quá ngắn hoặc bị thiếu dữ liệu.');
  const boxes=new Set();let offset=0,count=0;
  while(offset<file.size){
    if(++count>100000)throw new Error('Cấu trúc video không hợp lệ.');
    const bytes=new Uint8Array(await file.slice(offset,offset+16).arrayBuffer());
    if(bytes.length<8)throw new Error('Video bị cắt cụt.');
    const view=new DataView(bytes.buffer);let size=view.getUint32(0),minimum=8;
    const type=String.fromCharCode(...bytes.slice(4,8));
    if(size===1){if(bytes.length<16)throw new Error('Video bị thiếu phần đầu.');const big=view.getBigUint64(8);if(big>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Video quá lớn.');size=Number(big);minimum=16;}
    if(size===0)size=file.size-offset;
    if(size<minimum||offset+size>file.size)throw new Error('Video chưa tải đầy đủ.');
    boxes.add(type);offset+=size;
  }
  if(!['ftyp','moov','mdat'].every(type=>boxes.has(type)))throw new Error('File tải về không phải video MP4 đầy đủ.');
  return true;
}
export async function hashFile(file){const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function safeFolder(username){let name=username.replace(/\.+$/,'');if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name))name='@'+name;if(!/^@?[a-zA-Z0-9_.]{1,65}$/.test(name)||!name.replaceAll('.',''))throw new Error('Tên tài khoản không hợp lệ.');return name;}
