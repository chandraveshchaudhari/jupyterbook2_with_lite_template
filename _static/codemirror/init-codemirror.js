// Optional CodeMirror initializer. Place CodeMirror distribution under _static/codemirror/.
// This file tries to initialize CodeMirror if available; otherwise the runner falls back.
(function(){
  function dispatchReady(){
    window.dispatchEvent(new Event('codemirror-loaded'));
  }

  function tryInit(){
    if(window.CodeMirror){
      dispatchReady();
      return;
    }

    const script = document.createElement('script');
    const current = document.currentScript && document.currentScript.src;
    script.src = current ? new URL('./codemirror.bundle.js', current).href : new URL('./_static/codemirror/codemirror.bundle.js', document.baseURI).href;
    script.onload = function(){
      console.info('Local CodeMirror bundle loaded');
      dispatchReady();
    };
    script.onerror = function(){
      console.info('CodeMirror bundle not found; using textarea fallback');
    };
    document.head.appendChild(script);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
