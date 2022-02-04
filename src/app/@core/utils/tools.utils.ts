export function copyToClipboard(text: string): void {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.zIndex = '-1000';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}