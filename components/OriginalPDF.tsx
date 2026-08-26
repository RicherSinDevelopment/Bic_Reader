import { Text } from "@/components/ui/text";
import type { SwitchHighlightTarget } from "@/hooks/switchhighlight";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

// Metro exposes these generated binary files as numeric asset module IDs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDF_JS_ASSET = require("@/assets/pdfjs/pdf.min.mjs.bin");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDF_WORKER_ASSET = require("@/assets/pdfjs/pdf.worker.min.mjs.bin");
const RANGE_CHUNK_SIZE = 128 * 1024;

type OriginalPdfProps = {
  pdfUri: string;
  fileSize?: number;
  initialPage?: number;
  onPageChanged?: (page: number, totalPages: number) => void;
  onOutlineChanged?: (outline: PdfOutlineItem[]) => void;
  highlightTarget?: SwitchHighlightTarget | null;
  outlineOnly?: boolean;
  destination?: { page: number; nonce: number } | null;
};

export type PdfOutlineItem = {
  title: string;
  page: number;
  children: PdfOutlineItem[];
};

type PdfJsSources = { library: string; worker: string };

let cachedSources: Promise<PdfJsSources> | null = null;

async function loadPdfJsSources() {
  cachedSources ??= (async () => {
    const assets = [Asset.fromModule(PDF_JS_ASSET), Asset.fromModule(PDF_WORKER_ASSET)];
    await Promise.all(assets.map((asset) => asset.downloadAsync()));
    const [library, worker] = await Promise.all(
      assets.map((asset) => {
        const uri = asset.localUri ?? asset.uri;
        return FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }),
    );
    return { library, worker };
  })();
  return cachedSources;
}

function makeViewerHtml(sources: PdfJsSources, size: number, firstChunk: string, initialPage: number, outlineOnly: boolean) {
  const config = JSON.stringify({
    library: sources.library,
    worker: sources.worker,
    fileSize: size,
    firstChunk,
    initialPage: Math.max(1, initialPage),
    rangeChunkSize: RANGE_CHUNK_SIZE,
    outlineOnly,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<style>
*{box-sizing:border-box}html,body{margin:0;background:#f7f5ec;color:#222;font-family:-apple-system,BlinkMacSystemFont,sans-serif}body{overflow-y:auto;-webkit-overflow-scrolling:touch}#pages{padding:8px 0 48px}.page{position:relative;width:100%;margin:0 auto 8px;background:white;box-shadow:0 1px 2px #0002;overflow:hidden;contain:layout paint}.page canvas{display:block;width:100%;height:100%}.textLayer{position:absolute;inset:0;overflow:hidden;opacity:1;line-height:1;text-align:initial;text-size-adjust:none;transform-origin:0 0;z-index:3}.textLayer :is(span,br){position:absolute;color:transparent;white-space:pre;cursor:text;transform-origin:0 0}.textLayer ::selection{background:rgba(40,120,255,.35)}.switchHighlight{position:absolute;z-index:2;border-radius:3px;background:rgba(255,210,42,.62);box-shadow:0 0 0 1px rgba(214,160,0,.18);pointer-events:none;animation:switchHighlightPulse 1.2s ease-out forwards}@keyframes switchHighlightPulse{0%{background:rgba(255,210,42,.56);box-shadow:0 0 0 0 rgba(214,160,0,.3);opacity:.82}32%{background:rgba(255,210,42,.92);box-shadow:0 0 0 4px rgba(214,160,0,.2);opacity:1}62%{background:rgba(255,210,42,.66);box-shadow:0 0 0 1px rgba(214,160,0,.12);opacity:.9}100%{background:rgba(255,210,42,0);box-shadow:0 0 0 0 rgba(214,160,0,0);opacity:0}}@keyframes switchHighlightFade{from{opacity:.9}to{opacity:0}}@media(prefers-reduced-motion:reduce){.switchHighlight{animation:switchHighlightFade .8s ease-out forwards}}.status{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f7f5ec;z-index:20;color:#555}.spinner{width:28px;height:28px;border:3px solid #8fb99644;border-top-color:#8fb996;border-radius:50%;animation:spin .8s linear infinite;margin-right:12px}@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div id="status" class="status"><div class="spinner"></div><span>Opening PDF…</span></div><main id="pages"></main>
<script type="module">
const CONFIG=${config};if('scrollRestoration' in history)history.scrollRestoration='manual';
const decode=b64=>{const raw=atob(b64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out};
const moduleUrl=URL.createObjectURL(new Blob([decode(CONFIG.library)],{type:'text/javascript'}));
const workerUrl=URL.createObjectURL(new Blob([decode(CONFIG.worker)],{type:'text/javascript'}));
const pdfjs=await import(moduleUrl);pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
class NativeRangeTransport extends pdfjs.PDFDataRangeTransport{requestDataRange(begin,end){window.ReactNativeWebView.postMessage(JSON.stringify({type:'requestRange',begin,end}))}abort(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'abort'}))}}
const transport=new NativeRangeTransport(CONFIG.fileSize,decode(CONFIG.firstChunk));
let documentProxy,totalPages=0,currentTarget=null,suppressScroll=false,currentPage=1,isScrolling=false;
const rendered=new Map(),rendering=new Map(),textScheduled=new Set(),preloadScheduled=new Set(),pages=document.getElementById('pages'),status=document.getElementById('status');
const send=(value)=>window.ReactNativeWebView.postMessage(JSON.stringify(value));
function receive(event){let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}if(data.type==='rangeData'){transport.onDataRange(data.begin,decode(data.base64));transport.onDataProgress(Math.min(data.begin+data.byteLength,CONFIG.fileSize),CONFIG.fileSize)}else if(data.type==='highlight'){showTarget(data.target)}else if(data.type==='goToPage'){goToPage(data.page,false)}}
window.addEventListener('message',receive);document.addEventListener('message',receive);
function buildPlaceholders(count,ratio){const fragment=document.createDocumentFragment();for(let n=1;n<=count;n++){const section=document.createElement('section');section.className='page';section.dataset.page=String(n);section.style.height=(document.documentElement.clientWidth*ratio)+'px';fragment.appendChild(section)}pages.appendChild(fragment)}
const whenIdle=callback=>window.requestIdleCallback?window.requestIdleCallback(callback):setTimeout(callback,120);
function scheduleText(number,page,viewport,section){if(textScheduled.has(number))return;textScheduled.add(number);whenIdle(async()=>{if(isScrolling){textScheduled.delete(number);setTimeout(()=>scheduleText(number,page,viewport,section),180);return}try{if(rendered.get(number)?.page!==page)return;const textContent=await page.getTextContent();if(rendered.get(number)?.page!==page)return;const text=document.createElement('div');text.className='textLayer';section.appendChild(text);await new pdfjs.TextLayer({textContentSource:textContent,container:text,viewport}).render()}finally{textScheduled.delete(number)}})}
async function renderPage(number,zoomQuality=1,force=false){if(number<1||number>totalPages)return;if(!force&&rendered.has(number))return rendered.get(number);if(rendering.has(number)){await rendering.get(number);if(!force)return rendered.get(number)}const task=(async()=>{const previous=rendered.get(number),page=previous?.page||await documentProxy.getPage(number),section=pages.children[number-1],base=page.getViewport({scale:1}),scale=section.clientWidth/base.width,viewport=page.getViewport({scale});section.style.height=viewport.height+'px';const canvas=document.createElement('canvas'),pixelBudget=zoomQuality>1?14000000:8000000,desiredScale=Math.min((window.devicePixelRatio||1)*Math.max(1,zoomQuality),7),outputScale=Math.min(desiredScale,Math.sqrt(pixelBudget/(viewport.width*viewport.height))),context=canvas.getContext('2d',{alpha:false,desynchronized:true});canvas.width=Math.max(1,Math.floor(viewport.width*outputScale));canvas.height=Math.max(1,Math.floor(viewport.height*outputScale));canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';await page.render({canvasContext:context,viewport,transform:outputScale===1?null:[outputScale,0,0,outputScale,0,0]}).promise;section.replaceChildren(canvas);rendered.set(number,{page,viewport,section,outputScale});rendering.delete(number);scheduleText(number,page,viewport,section);if(currentTarget?.page===number)drawHighlight(currentTarget);return rendered.get(number)})();rendering.set(number,task);try{return await task}catch(error){rendering.delete(number);throw error}}
function scheduleRender(number){if(number<1||number>totalPages||rendered.has(number)||rendering.has(number)||preloadScheduled.has(number))return;preloadScheduled.add(number);whenIdle(()=>{preloadScheduled.delete(number);if(isScrolling){setTimeout(()=>scheduleRender(number),180);return}renderPage(number)})}
function unloadFarPages(center){for(const [number,item] of rendered){if(Math.abs(number-center)>3){item.page.cleanup();item.section.replaceChildren();rendered.delete(number)}}}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const number=Number(entry.target.dataset.page);renderPage(number);scheduleRender(number+1);scheduleRender(number-1)}},{rootMargin:'65% 0px',threshold:.01});
function pageAtViewportCenter(){const element=document.elementFromPoint(Math.max(1,window.innerWidth/2),Math.max(1,window.innerHeight/2));return Number(element?.closest?.('.page')?.dataset.page)||currentPage}
async function goToPage(page,smooth=true){const number=Math.max(1,Math.min(totalPages||page,Number(page)||1)),section=pages.children[number-1];if(!section)return;suppressScroll=true;currentPage=number;await renderPage(number);if(smooth){section.scrollIntoView({behavior:'smooth',block:'start'})}else{window.scrollTo({top:Math.max(0,section.offsetTop||0),left:0,behavior:'auto'})}unloadFarPages(number);send({type:'pageChanged',page:number,totalPages});setTimeout(()=>{suppressScroll=false},smooth?700:100)}
function clearHighlight(){document.querySelectorAll('.switchHighlight').forEach(node=>node.remove())}
function drawHighlight(target){clearHighlight();const item=rendered.get(target.page);if(!item)return;const bounds=target.sourceBounds,pageSize=target.pageSize;if(!bounds||!pageSize?.width||!pageSize?.height)return;const mark=document.createElement('div');mark.className='switchHighlight';mark.style.left=(bounds.left/pageSize.width*100)+'%';mark.style.top=(bounds.top/pageSize.height*100)+'%';mark.style.width=(Math.max(1,bounds.right-bounds.left)/pageSize.width*100)+'%';mark.style.height=(Math.max(1,bounds.bottom-bounds.top)/pageSize.height*100)+'%';mark.addEventListener('animationend',()=>{if(mark.isConnected)mark.remove();if(currentTarget===target)currentTarget=null},{once:true});item.section.appendChild(mark)}
async function showTarget(target){currentTarget=target||null;clearHighlight();if(!target)return;suppressScroll=true;await goToPage(target.page,false);await renderPage(target.page);drawHighlight(target);setTimeout(()=>{suppressScroll=false},250)}
async function resolveOutline(items){return Promise.all((items||[]).map(async item=>{let destination=item.dest;if(typeof destination==='string')destination=await documentProxy.getDestination(destination);const reference=Array.isArray(destination)?destination[0]:null;let page=1;try{page=typeof reference==='number'?reference+1:(await documentProxy.getPageIndex(reference))+1}catch{}return{title:(item.title||'').trim(),page,children:await resolveOutline(item.items)}}))}
let scrollTimer;window.addEventListener('scroll',()=>{isScrolling=true;if(!suppressScroll&&currentTarget){currentTarget=null;clearHighlight();send({type:'highlightDismissed'})}clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{isScrolling=false;currentPage=pageAtViewportCenter();unloadFarPages(currentPage);scheduleRender(currentPage+1);scheduleRender(currentPage-1);send({type:'pageChanged',page:currentPage,totalPages})},140)},{passive:true});
let zoomTimer;function finishZoom(){clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>{currentPage=pageAtViewportCenter();const zoom=Math.max(1,window.visualViewport?.scale||1);renderPage(currentPage,zoom,true)},220)}if(window.visualViewport){window.visualViewport.addEventListener('resize',finishZoom);window.visualViewport.addEventListener('scroll',finishZoom)}
try{documentProxy=await pdfjs.getDocument({range:transport,length:CONFIG.fileSize,rangeChunkSize:CONFIG.rangeChunkSize,disableStream:true,disableAutoFetch:true}).promise;totalPages=documentProxy.numPages;let outline=[];try{outline=await resolveOutline(await documentProxy.getOutline())}catch{}send({type:'outline',outline});if(CONFIG.outlineOnly){status.remove();send({type:'ready',totalPages})}else{const firstPage=await documentProxy.getPage(1),firstViewport=firstPage.getViewport({scale:1});buildPlaceholders(totalPages,firstViewport.height/firstViewport.width);for(const section of pages.children)observer.observe(section);status.remove();await goToPage(CONFIG.initialPage,false);requestAnimationFrame(()=>{requestAnimationFrame(()=>{const section=pages.children[Math.max(1,CONFIG.initialPage)-1];if(section){const targetTop=Math.max(0,section.offsetTop||0),delta=Math.abs(window.scrollY-targetTop);if(delta>1&&delta<600)window.scrollTo({top:targetTop,left:0,behavior:'auto'})}})})send({type:'ready',totalPages})}}catch(error){status.innerHTML='<span>Could not open this PDF</span>';send({type:'error',message:String(error?.message||error)})}
</script></body></html>`;
}

export default function OriginalPDF({
  pdfUri,
  fileSize,
  initialPage = 1,
  onPageChanged,
  onOutlineChanged,
  highlightTarget,
  outlineOnly = false,
  destination,
}: OriginalPdfProps) {
  const webViewRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await FileSystem.getInfoAsync(pdfUri);
      if (!info.exists) throw new Error("The PDF file is no longer available.");
      const size = fileSize || info.size;
      if (!size) throw new Error("Could not determine the PDF file size.");
      const [sources, firstChunk] = await Promise.all([
        loadPdfJsSources(),
        FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: 0,
          length: Math.min(size, RANGE_CHUNK_SIZE),
        }),
      ]);
      if (!cancelled) setHtml(makeViewerHtml(sources, size, firstChunk, initialPage, outlineOnly));
    })().catch((error) => {
      if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Preview unavailable.");
    });
    return () => { cancelled = true; };
  }, [fileSize, initialPage, outlineOnly, pdfUri]);

  const sendToViewer = useCallback((message: object) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (ready) sendToViewer({ type: "highlight", target: highlightTarget ?? null });
  }, [highlightTarget, ready, sendToViewer]);

  useEffect(() => {
    if (ready && destination) {
      sendToViewer({ type: "goToPage", page: Math.max(1, destination.page) });
    }
  }, [destination, ready, sendToViewer]);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: { type: string; [key: string]: unknown };
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "requestRange") {
      const begin = Number(message.begin);
      const end = Number(message.end);
      try {
        const base64 = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: begin,
          length: end - begin,
        });
        sendToViewer({ type: "rangeData", begin, byteLength: end - begin, base64 });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not read the PDF.");
      }
    } else if (message.type === "ready") {
      setReady(true);
    } else if (message.type === "pageChanged") {
      onPageChanged?.(Number(message.page), Number(message.totalPages));
    } else if (message.type === "outline") {
      onOutlineChanged?.((message.outline as PdfOutlineItem[]) ?? []);
    } else if (message.type === "error") {
      setErrorMessage(String(message.message ?? "Preview unavailable."));
    }
  }, [onOutlineChanged, onPageChanged, pdfUri, sendToViewer]);

  const source = useMemo(() => html ? { html, baseUrl: "https://bic-reader.local/" } : undefined, [html]);

  if (errorMessage) return <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]"><Text className="text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">Could not open this PDF</Text><Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">{errorMessage}</Text></View>;
  if (!source) return <View className="flex-1 items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]"><ActivityIndicator size="large" color="#8fb996" /></View>;

  return <WebView ref={webViewRef} source={source} originWhitelist={["*"]} onMessage={handleMessage} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback bounces={false} style={{ flex: 1, backgroundColor: isDark ? "#10120F" : "#F7F5EC" }} />;
}
