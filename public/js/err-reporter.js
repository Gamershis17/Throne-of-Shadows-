window._errs = [];
window.addEventListener('error', function(e) {
  window._errs.push((e.message || 'unknown') + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
  var d = document.getElementById('js-error-box');
  if (!d) {
    d = document.createElement('div');
    d.id = 'js-error-box';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#a00;color:#fff;padding:10px;z-index:99999;font-size:12px;max-height:200px;overflow:auto;';
    document.body.appendChild(d);
  }
  d.textContent = 'JS ERROR: ' + window._errs.join(' | ');
});
