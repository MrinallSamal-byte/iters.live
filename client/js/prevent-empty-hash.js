// Prevent default behavior for empty hash links to avoid jumping to top
(function(){
  document.addEventListener('click', function(e){
    const a = e.target.closest('a[href="#"]');
    if (!a) return;
    e.preventDefault();
  }, true);
})();
