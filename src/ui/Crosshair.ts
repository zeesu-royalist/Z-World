export class Crosshair {
  private element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'crosshair';
    this.element.innerHTML = `
      <div class="crosshair-dot"></div>
      <div class="crosshair-line top"></div>
      <div class="crosshair-line bottom"></div>
      <div class="crosshair-line left"></div>
      <div class="crosshair-line right"></div>
    `;
    document.body.appendChild(this.element);
  }

  public setAiming(isAiming: boolean): void {
    if (isAiming) {
      this.element.classList.add('aiming');
    } else {
      this.element.classList.remove('aiming');
    }
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }
}
