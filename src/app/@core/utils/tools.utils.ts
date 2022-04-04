export function copyToClipboard(text: string): void {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.zIndex = '-1000';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export function download(data: string, name: string): void {
  const encodedUri = encodeURI(data);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", name);
  document.body.appendChild(link);
  link.click();
}
