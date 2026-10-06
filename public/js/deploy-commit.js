// Deploy commit hash display (bottom-left of login screen).
// External file (not inline) so Content Security Policy allows it.
(function () {
  fetch('/api/status')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var el = document.getElementById('deploy-commit');
      if (el && d && d.commit) el.textContent = '(' + d.commit.substring(0, 7) + ')';
    })
    .catch(function () {});
})();
