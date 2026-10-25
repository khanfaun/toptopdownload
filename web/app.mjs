import {videoKey,summarize,mergeQueue,verifyMP4,hashFile} from './shared.mjs';
const $=id=>document.getElementById(id);
const elements={url:$('url'),find:$('find'),paste:$('paste'),folder:$('choose-folder'),folderName:$('folder-name'),selectAccount:$('select-account'),selectPage:$('select-page'),deselectPage:$('deselect-page'),previous:$('previous'),next:$('next'),download:$('download'),resume:$('resume'),pause:$('pause'),progress:$('progress'),overall:$('overall'),current:$('current'),status:$('status')};
const state={pages:[],page:0,username:'',type:'',selected:new Map(),job:[],folder:null,busy:false,operation:'',controller:null};
const directorySupported='showDirectoryPicker' in window && window.isSecureContext;
let db=null,saveTimer=null,toastTimer=null;
function log(text){const output=$('logs');output.textContent=(`${output.textContent}\n[${new Date().toLocaleTimeString('vi-VN')}] ${text}`).split('\n').slice(-150).join('\n');output.scrollTop=output.scrollHeight;}
function status(text){elements.status.textContent=text;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function setFolder(folder){state.folder=folder;$('folder-name').textContent=folder?folder.name:'Tải xuống của trình duyệt';$('folder-help').textContent=folder?'Video sẽ được lưu thẳng vào thư mục này.':'Video được tải vào mục Tải xuống theo cài đặt trình duyệt. Nhấn Ctrl+J để xem.';}
function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('tiktok-saver',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function read(key){if(!db)return Promise.resolve(null);return new Promise((resolve,reject)=>{const request=db.transaction('records').objectStore('records').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function write(key,value){if(!db)return Promise.resolve();return new Promise((resolve,reject)=>{const transaction=db.transaction('records','readwrite');transaction.objectStore('records').put(value,key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});}
function snapshot(){return {pages:state.pages,page:state.page,username:state.username,type:state.type,selected:[...state.selected.values()],job:state.job,url:elements.url.value};}
async function save(){try{await write('state',snapshot());}catch(error){log('Không lưu được tiến độ: '+error.message);toast('Trình duyệt chưa lưu được tiến độ. Hãy giữ tab này mở.');}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,150);}
function pageVideos(){return state.pages[state.page]?.videos||[];}
function refresh(){
  const count=state.selected.size;
  $('selected-count').textContent=count?`${count} video đã chọn`:'Chọn video bạn muốn tải';
  elements.download.innerHTML=count?`Tải ${count} video <span>↓</span>`:'Tải đã chọn <span>↓</span>';
  for(const element of [elements.url,elements.find,elements.paste,elements.folder])element.disabled=state.busy;
  for(const element of [elements.selectPage,elements.deselectPage])element.disabled=state.busy||!pageVideos().length;
  elements.selectAccount.disabled=state.busy||state.type!=='profile'||!state.pages.length;
  elements.previous.disabled=state.busy||state.page===0;
  elements.next.disabled=state.busy||state.type!=='profile'||!(state.page<state.pages.length-1||state.pages.at(-1)?.nextCursor);
  elements.download.disabled=state.busy||!count;
  elements.resume.disabled=state.busy||!state.job.length;
  elements.pause.hidden=!state.busy;elements.resume.hidden=state.busy;
  elements.pause.disabled=state.controller?.signal.aborted||false;
  elements.pause.textContent=state.operation==='scan'?'Dừng tìm thêm':'Tạm dừng';
  $('page-label').textContent=state.pages.length?(state.type==='video'?'1 video':`Trang ${state.page+1}`):'—';
  document.querySelectorAll('.card').forEach(card=>{const chosen=state.selected.has(card.dataset.key);card.classList.toggle('chosen',chosen);card.querySelector('input').checked=chosen;card.querySelector('input').disabled=state.busy;card.querySelector('.choose span').textContent=chosen?'Đã chọn':'Chọn video';card.querySelector('.preview-button').disabled=state.busy;});
}
function render(){
  const videos=pageVideos();$('empty').hidden=!!videos.length;$('gallery').replaceChildren();
  $('gallery-title').textContent=state.type==='profile'?`@${state.username}`:state.type==='video'?'Video bạn vừa tìm':'Video của bạn';
  $('gallery-note').textContent=videos.length?`${videos.length} video trên trang này · Bấm ảnh hoặc ô chọn để chọn video.`:'Ảnh xem trước sẽ xuất hiện sau khi tìm kiếm.';
  for(const video of videos){
    const card=document.createElement('article');card.className='card';card.dataset.key=videoKey(video);
    card.innerHTML='<button class="preview-button" type="button"><span class="image-placeholder">Chưa có ảnh xem trước</span><img loading="lazy" referrerpolicy="no-referrer"></button><div class="card-body"><label class="choose"><input type="checkbox"><span>Chọn video</span></label><p class="card-title"></p><p class="card-owner"></p></div>';
    const image=card.querySelector('img');image.alt='Ảnh xem trước: '+(video.title||'video TikTok');if(video.thumbnail)image.src=video.thumbnail;
    image.addEventListener('error',()=>{image.remove();card.querySelector('.image-placeholder').textContent='Ảnh chưa tải được';});
    card.querySelector('.card-title').textContent=video.title||'Video chưa có chú thích';card.querySelector('.card-title').title=video.title||'';card.querySelector('.card-owner').textContent='@'+video.username;
    const toggle=()=>{if(state.busy)return;const key=videoKey(video);if(state.selected.has(key))state.selected.delete(key);else state.selected.set(key,video);refresh();scheduleSave();};
    card.querySelector('input').addEventListener('change',toggle);card.querySelector('.preview-button').addEventListener('click',toggle);card.querySelector('.preview-button').setAttribute('aria-label','Chọn video '+(video.title||video.id));
    $('gallery').append(card);
  }
  refresh();
}
function startOperation(name){state.busy=true;state.operation=name;state.controller=new AbortController();refresh();return state.controller.signal;}
function finishOperation(){state.busy=false;state.operation='';state.controller=null;if(!elements.progress.hasAttribute('value'))elements.progress.value=0;refresh();scheduleSave();}
async function apiSearch(url,cursor='0',page=0,signal){
  const response=await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,cursor,page}),signal});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Chưa tìm được video.');return result;
}
function errorMessage(error){return error.name==='AbortError'?'Đã tạm dừng. Bạn có thể tiếp tục sau.':error.message||'Kết nối bị gián đoạn. Hãy thử lại.';}
async function find(event){event?.preventDefault();if(state.busy)return;const input=elements.url.value.trim();if(!input){elements.url.focus();return;}
  const signal=startOperation('find');status('Đang tìm video… Thường chỉ mất vài giây.');
  try{const result=await apiSearch(input,'0',0,signal);state.pages=[{...result,cursor:'0'}];state.page=0;state.username=result.username;state.type=result.type;state.selected.clear();if(result.type==='video')for(const video of result.videos)state.selected.set(videoKey(video),video);render();status(result.type==='video'?'Đã tìm thấy video và chọn sẵn cho bạn. Bấm Tải 1 video để lưu.':'Chọn những video bạn thích hoặc bấm Chọn toàn bộ tài khoản.');log(`Tìm thấy ${result.videos.length} video trên trang đầu của @${result.username}.`);await save();}catch(error){status(errorMessage(error));log(errorMessage(error));}finally{finishOperation();}
}
async function next(){if(state.busy)return;if(state.page<state.pages.length-1){state.page++;render();scheduleSave();return;}const cursor=state.pages.at(-1)?.nextCursor;if(!cursor)return;
  const signal=startOperation('page');status('Đang lấy thêm video… Các lựa chọn trước đó vẫn được giữ.');
  try{if(state.pages.some(p=>p.cursor===cursor))throw new Error('Dịch vụ lặp lại một trang. Hãy thử lại sau.');const result=await apiSearch(`https://www.tiktok.com/@${state.username}`,cursor,state.pages.length,signal);if(!result.videos.length){state.pages.at(-1).nextCursor=null;status('Bạn đã xem hết các video hiện có.');}else{state.pages.push({...result,cursor});state.page++;render();status(`Đã mở trang ${state.page+1}.`);}await save();}catch(error){status(errorMessage(error));}finally{finishOperation();}}
async function selectAccount(){if(state.busy||!state.pages.length)return;
  const signal=startOperation('scan');elements.progress.removeAttribute('value');
  for(const page of state.pages)for(const video of page.videos)state.selected.set(videoKey(video),video);
  refresh();
  try{const seen=new Set(state.pages.map(p=>p.cursor));while(state.pages.at(-1).nextCursor){
    const cursor=state.pages.at(-1).nextCursor;if(seen.has(cursor))throw new Error('Dịch vụ lặp lại trang đã xem. Các video tìm được vẫn được chọn.');seen.add(cursor);
    elements.overall.textContent=`Đã chọn ${state.selected.size} video · ${state.pages.length} trang`;
    elements.current.textContent='Đang tìm các trang còn lại…';status('Đang chọn toàn bộ tài khoản. Bạn không cần mở từng trang.');
    const result=await apiSearch(`https://www.tiktok.com/@${state.username}`,cursor,state.pages.length,signal);
    if(!result.videos.length){state.pages.at(-1).nextCursor=null;break;}
    state.pages.push({...result,cursor});for(const video of result.videos)state.selected.set(videoKey(video),video);refresh();await save();
  }if(signal.aborted)throw new DOMException('Paused','AbortError');elements.progress.value=100;elements.overall.textContent=`Đã chọn đủ ${state.selected.size} video`;
  elements.current.textContent=`Tất cả ${state.pages.length} trang`;
  status(`Đã chọn toàn bộ ${state.selected.size} video. Bấm Tải ${state.selected.size} video để lưu tất cả.`);log(`Đã đọc toàn bộ ${state.pages.length} trang, chọn ${state.selected.size} video duy nhất.`);
  }catch(error){status(signal.aborted?'Đã dừng tìm thêm. Các video tìm được vẫn được chọn. Bấm Chọn toàn bộ tài khoản để tìm tiếp.':errorMessage(error));elements.overall.textContent=`Đã chọn ${state.selected.size} video · Chưa đọc xong tất cả các trang`;elements.progress.value=0;}finally{finishOperation();}}
async function chooseFolder(){if(!directorySupported)return;
  try{const folder=await window.showDirectoryPicker({id:'tiktok-saver',mode:'readwrite'});setFolder(folder);status('Đã chọn thư mục. Video sẽ được lưu thẳng vào đây khi trình duyệt cho phép.');}
  catch(error){if(error.name!=='AbortError'){setFolder(null);status('Chưa chọn được thư mục riêng. Video vẫn có thể tải về mục Tải xuống.');toast('Không chọn được thư mục. Bạn vẫn có thể tải về mục Tải xuống bình thường.');log('Chọn thư mục bị từ chối hoặc trình duyệt không hỗ trợ: '+error.message);}}}
function showOverall(job){const s=summarize(job);const sent=job.filter(item=>item.status==='sent').length;const saved=s.done-sent;elements.progress.value=s.total?s.done*100/s.total:0;elements.overall.textContent=(sent?`Đã lưu ${saved}/${s.total} · Đã gửi ${sent}/${s.total} vào mục Tải xuống`:`Đã lưu ${saved}/${s.total} video`)+(s.failed?` · ${s.failed} chưa tải được`:'');}
async function existingReceipt(directory,video){
  const key=`receipt:${videoKey(video)}:${state.folder.name}`;const receipt=await read(key);if(!receipt)return null;
  try{const file=await(await directory.getFileHandle(receipt.filename)).getFile();if(file.size!==receipt.size||await hashFile(file)!==receipt.sha256)return null;await verifyMP4(file);return receipt;}catch{return null;}
}
async function downloadOne(video,signal){
  const directory=state.folder;
  if(directory){const existing=await existingReceipt(directory,video);if(existing){log(`Bỏ qua video đã có và kiểm tra hợp lệ: ${video.id}.`);return 'done';}}
  const response=await fetch('/api/download?url='+encodeURIComponent(video.url),{signal});
  if(!response.ok){const info=await response.json().catch(()=>({}));throw new Error(info.error||'Chưa tải được video này.');}
  if(response.headers.get('x-video-quality')!=='original-hd'){await response.body?.cancel();throw new Error('Không xác nhận được bản chất lượng cao.');}
  const total=Number(response.headers.get('content-length')||0);let done=0;const reader=response.body.getReader();let writer=null,part=null;const chunks=[];
  const filename=`SSSTikTok.dev_${video.id}_hd.mp4`,partName=filename+'.part';
  try{
    if(directory){part=await directory.getFileHandle(partName,{create:true});writer=await part.createWritable();}
    for(;;){if(signal.aborted)throw new DOMException('Paused','AbortError');const {done:ended,value}=await reader.read();if(ended)break;
      if(writer)await writer.write(value);else{if(done+value.length>150*1024*1024)throw new Error('Video lớn: hãy dùng Chrome/Edge và chọn thư mục để lưu trực tiếp.');chunks.push(value);}
      done+=value.length;elements.current.textContent=total?`Video hiện tại: ${Math.min(100,done*100/total).toFixed(0)}% · ${(done/1048576).toFixed(1)}/${(total/1048576).toFixed(1)} MB`:`Video hiện tại: ${(done/1048576).toFixed(1)} MB`;
    }
    if(!done||total&&done!==total)throw new Error('Video chưa tải đầy đủ. Hãy thử lại.');
    if(writer){await writer.close();writer=null;}
    if(signal.aborted)throw new DOMException('Paused','AbortError');
    const file=part?await part.getFile():new Blob(chunks,{type:'video/mp4'});status('Đang kiểm tra video vừa tải…');await verifyMP4(file);
    if(directory){
      const digest=await hashFile(file);if(signal.aborted)throw new DOMException('Paused','AbortError');let target=filename;
      try{await directory.getFileHandle(target);target=filename.replace('.mp4',`_${Date.now()}.mp4`);log('Giữ nguyên file cũ chưa được xác minh; lưu video mới với tên riêng.');}catch(error){if(error.name!=='NotFoundError')throw error;}
      const final=await directory.getFileHandle(target,{create:true});await file.stream().pipeTo(await final.createWritable());
      await write(`receipt:${videoKey(video)}:${state.folder.name}`,{filename:target,size:file.size,sha256:digest,quality:'original-hd'});
      await directory.removeEntry(partName);log(`Đã lưu và kiểm tra: ${target} · ${(file.size/1048576).toFixed(2)} MB`);return 'done';
    }
    const href=URL.createObjectURL(file);const anchor=document.createElement('a');anchor.href=href;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);log(`Đã chuyển ${filename} cho trình duyệt tải. Không xác nhận việc lưu trên ổ đĩa.`);return 'sent';
  }catch(error){await reader.cancel().catch(()=>{});if(writer)await writer.abort().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
async function download(resume=false){if(state.busy)return;
  // A custom folder is optional. If the browser declines access, continue with its normal Downloads location.
  if(state.folder){let permission='prompt';try{permission=await state.folder.queryPermission({mode:'readwrite'});if(permission!=='granted')permission=await state.folder.requestPermission({mode:'readwrite'});}catch(error){log('Không xác nhận được quyền thư mục: '+error.message);}
    if(permission!=='granted'){setFolder(null);status('Trình duyệt chưa cho phép ghi vào thư mục đã chọn. Lượt tải này sẽ dùng mục Tải xuống.');log('Chuyển sang mục Tải xuống của trình duyệt thay vì dừng lượt tải.');await write('folder',null).catch(()=>{});}}
  if(!resume)state.job=mergeQueue(state.job,[...state.selected.values()]);if(!state.job.length){toast('Chưa có video nào cần tải.');return;}
  state.job=state.job.map(item=>['done','sent'].includes(item.status)?item:{...item,status:'pending'});await save();const signal=startOperation('download');let paused=false;
  try{for(let index=0;index<state.job.length;index++){
    if(signal.aborted){paused=true;break;}const item=state.job[index];showOverall(state.job);status(`Đang xử lý video ${index+1}/${state.job.length} — ${(item.video.title||'Video chưa có chú thích').slice(0,75)}`);elements.current.textContent='Đang lấy bản chất lượng cao hoặc kiểm tra video đã có…';
    try{item.status=await downloadOne(item.video,signal);item.error=null;}catch(error){if(signal.aborted||error.name==='AbortError'){item.status='pending';paused=true;break;}item.status='failed';item.error=errorMessage(error);log(`Chưa tải được ${item.video.id}: ${item.error}`);}
    await save();showOverall(state.job);
  }
  const summary=summarize(state.job);showOverall(state.job);
  if(paused){status(`Đã tạm dừng. ${summary.done}/${summary.total} video đã hoàn tất. Bấm Tiếp tục tải để làm tiếp.`);}
  else if(summary.failed){status(`Đã hoàn tất ${summary.done}/${summary.total} video. Còn ${summary.failed} video chưa tải được; bấm Tiếp tục tải để thử lại.`);}
  else{const sent=state.job.filter(item=>item.status==='sent').length;const saved=summary.done-sent;status(sent?`Đã gửi ${sent} video vào mục Tải xuống của trình duyệt${saved?` và lưu ${saved} video vào thư mục đã chọn`:''}. Nhấn Ctrl+J để xem danh sách tải.`:`Đã lưu xong ${saved} video thẳng vào thư mục ${state.folder?.name||'đã chọn'}.`);state.job=[];}
  elements.current.textContent=paused?'Tiến độ đã được nhớ tự động':summary.failed?'Các video lỗi chưa được tính là hoàn tất':'Hoàn tất';await save();
  }catch(error){status(errorMessage(error));log(errorMessage(error));await save();}finally{finishOperation();}}
$('search-form').addEventListener('submit',find);elements.next.addEventListener('click',next);elements.previous.addEventListener('click',()=>{if(state.page>0&&!state.busy){state.page--;render();scheduleSave();}});
elements.selectAccount.addEventListener('click',selectAccount);elements.selectPage.addEventListener('click',()=>{for(const video of pageVideos())state.selected.set(videoKey(video),video);refresh();scheduleSave();});elements.deselectPage.addEventListener('click',()=>{for(const video of pageVideos())state.selected.delete(videoKey(video));refresh();scheduleSave();});elements.folder.addEventListener('click',chooseFolder);elements.download.addEventListener('click',()=>download(false));elements.resume.addEventListener('click',()=>download(true));elements.pause.addEventListener('click',()=>{state.controller?.abort();elements.pause.disabled=true;status('Đang tạm dừng… Tiến độ được giữ tự động.');});
elements.paste.addEventListener('click',async()=>{try{elements.url.value=await navigator.clipboard.readText();elements.url.focus();}catch{toast('Bấm chuột phải → Dán, hoặc dùng Ctrl+V trong ô liên kết.');elements.url.focus();}});
window.addEventListener('beforeunload',event=>{if(state.busy){event.preventDefault();event.returnValue='';}});
async function initialize(){
  try{db=await openDB();const saved=await read('state');if(saved){state.pages=saved.pages||[];state.page=Math.min(saved.page||0,Math.max(0,state.pages.length-1));state.username=saved.username||'';state.type=saved.type||'';state.selected=new Map((saved.selected||[]).map(video=>[videoKey(video),video]));state.job=saved.job||[];elements.url.value=saved.url||'';}
    setFolder(null);if(!directorySupported)elements.folder.hidden=true;else elements.folder.textContent='Chọn thư mục khác (tùy chọn)';
    if(state.job.length){showOverall(state.job);status(`Có lượt tải ${state.job.length} video chưa hoàn tất. Bấm Tiếp tục tải để làm tiếp.`);}
  }catch(error){log(error.message);status('Chế độ riêng tư: tiến độ có thể không được giữ khi đóng tab.');}
  render();
}
initialize();
