// @name Hello Overlay
// A harmless example showing the cleanup contract supported by the loader.

const badge = document.createElement('div');
badge.textContent = 'Desktop script active';
Object.assign(badge.style, {
  position: 'fixed',
  right: '18px',
  bottom: '18px',
  zIndex: '2147483647',
  padding: '10px 14px',
  borderRadius: '8px',
  background: '#171e23',
  border: '1px solid #ffbf3f',
  color: '#ffbf3f',
  font: '700 12px system-ui',
  boxShadow: '0 8px 30px #0009'
});
document.body.appendChild(badge);

return () => badge.remove();
