// oukitel-station-card — one card for one Oukitel power station.
//
// WHY
//   Eugene, 2026-10-23 09:12: "давай обєднаємо ці 2 компонента в 1 картку", over a
//   screenshot with the "Oukitel battery / station offline" banner and the three
//   grey buttons under it. The dashboard held two pieces of one thing: a `tile`
//   for the battery and a horizontal-stack of three mushroom cards for the
//   outputs. This card is that one thing.
//
// THE AWAY STATE IS A LOCK, NOT A STYLE
//   On 2026-10-23 the station tiles greyed through card_mod `pointer-events: none`.
//   The mobile app did not apply that style, so a tap still reached the switch.
//   Here every output is a real <button disabled> while `online` is not `on`, and
//   the handler returns before it builds a service call. One rule for the browser
//   and the app.
//
// THE AC GUARD
//   Turning AC 230V off while the house runs from the station cuts the house. An
//   output with `confirm: true` asks first, in the card: the output row becomes
//   one question with Cancel and Turn off. The question appears only when the
//   output is on and the `grid` entity (if set) is not on.
//
// CONFIG
//   type: custom:oukitel-station-card
//   name: Oukitel BP2000
//   battery: sensor.oukitel_battery
//   online: binary_sensor.oukitel_device_online
//   runtime: sensor.oukitel_runtime_estimate
//   input_power: sensor.oukitel_total_input_power
//   output_power: sensor.oukitel_total_output_power
//   grid: binary_sensor.grid_present_relay
//   outputs:
//     - entity: switch.oukitel_ac_output
//       name: AC 230V
//       icon: mdi:power-plug
//       confirm: true
//     - entity: switch.oukitel_usb_output
//       name: USB
//       icon: mdi:usb-port
//     - entity: switch.oukitel_dc_12v_output
//       name: DC 12V
//       icon: mdi:car
//
//   `battery` and `outputs` are required. Every other entity is optional; without
//   `online` the card treats the station as present, and without `grid` a
//   `confirm` output asks before every turn-off.
//
// TWO LANGUAGES
//   The card follows the profile language, like the other cards in this workspace:
//   uk for Ukrainian, English for anything else.

const TAG = 'oukitel-station-card';
const VERSION = '1.0.1';

const DEFAULTS = {
  name: 'Oukitel',
};

const STRINGS = {
  uk: {
    offline: 'станція не в мережі',
    away: 'офлайн',
    charging: 'заряджається',
    on: 'Увімкнено',
    off: 'Вимкнено',
    unavailable: 'Недоступно',
    hours: 'год',
    confirm: 'Дім живиться від станції. Вимкнення {name} знеструмить дім.',
    cancel: 'Скасувати',
    turnOff: 'Вимкнути',
    moreInfo: 'Відкрити подробиці',
  },
  en: {
    offline: 'station offline',
    away: 'offline',
    charging: 'charging',
    on: 'On',
    off: 'Off',
    unavailable: 'Unavailable',
    hours: 'h',
    confirm: 'The house runs on the station. Turning off {name} cuts the power.',
    cancel: 'Cancel',
    turnOff: 'Turn off',
    moreInfo: 'Open details',
  },
};

const langOf = (hass) => (String((hass && hass.language) || 'en').toLowerCase().startsWith('uk') ? 'uk' : 'en');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

const numeric = (hass, entity) => {
  if (!entity) return null;
  const state = hass.states[entity]?.state;
  if (state === undefined || state === 'unknown' || state === 'unavailable' || state === '') return null;
  const value = Number.parseFloat(state);
  return Number.isFinite(value) ? value : null;
};

const STYLE = `
  :host { display: block; }
  ha-card { overflow: hidden; }
  .wrap { padding: 12px; }
  .head {
    display: flex; align-items: center; gap: 12px; min-width: 0;
    border-radius: 12px; cursor: pointer;
  }
  .head:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .bico {
    width: 40px; height: 40px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: var(--secondary-background-color, rgba(255, 255, 255, .06));
    color: var(--secondary-text-color);
    --mdc-icon-size: 22px;
  }
  .meta { flex: 1; min-width: 0; }
  .name {
    font-size: 15px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sub {
    margin-top: 2px; font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pct { font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; flex: none; }
  .away .bico { color: var(--disabled-text-color, #6f6f6f); }
  .bar {
    height: 4px; margin-top: 10px; border-radius: 2px; overflow: hidden;
    background: var(--divider-color, rgba(255, 255, 255, .08));
  }
  .bar span { display: block; height: 100%; border-radius: 2px; }
  .outs { display: flex; gap: 8px; margin-top: 12px; }
  .out {
    flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 8px;
    padding: 4px; border: 0; border-radius: 12px; background: none;
    color: inherit; font: inherit; text-align: left; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .out:hover { background: rgba(255, 255, 255, .04); }
  .out:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  .out[disabled] { cursor: default; background: none; }
  .oico {
    width: 36px; height: 36px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: var(--secondary-background-color, rgba(255, 255, 255, .06));
    color: var(--secondary-text-color);
    --mdc-icon-size: 20px;
  }
  .out.on .oico { background: rgba(33, 150, 243, .2); color: #42a5f5; }
  .out.away .oico { color: var(--disabled-text-color, #6f6f6f); }
  .otx { display: flex; flex-direction: column; min-width: 0; }
  .olabel {
    font-size: 13px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ostate { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color); }
  .out.away .olabel { color: var(--secondary-text-color); }
  .out.away .ostate { color: var(--disabled-text-color, #6f6f6f); }
  .sep {
    margin-top: 12px; padding-top: 12px;
    border-top: 1px solid var(--divider-color, rgba(255, 255, 255, .08));
  }
  .confirm { display: flex; flex-direction: column; gap: 10px; }
  .q { font-size: 13px; line-height: 1.35; color: var(--primary-text-color); text-align: center; }
  .acts { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .acts button {
    border: 0; border-radius: 10px; padding: 8px 14px;
    font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
  }
  .acts button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .no { background: var(--secondary-background-color, rgba(255, 255, 255, .08)); color: var(--primary-text-color); }
  .yes { background: #d32f2f; color: #fff; }
  .sr {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
`;

class OukitelStationCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="wrap"></div></ha-card>`;
    this._hub = this.shadowRoot.querySelector('.wrap');
    this._connect();
  }

  // The listener lives on the shadow root, so it sees every render without
  // being added again: the children are replaced, the root is not.
  _connect() {
    this.shadowRoot.addEventListener('click', (event) => this._onClick(event));
    this.shadowRoot.addEventListener('keydown', (event) => this._onKey(event));
  }

  setConfig(config) {
    if (!config || !config.battery) throw new Error('oukitel-station-card: `battery` is required');
    if (!Array.isArray(config.outputs) || config.outputs.length === 0) {
      throw new Error('oukitel-station-card: `outputs` must hold at least one entity');
    }
    this._config = {
      ...DEFAULTS,
      ...config,
      outputs: config.outputs.map((output, index) => ({
        entity: output.entity,
        name: output.name || `Output ${index + 1}`,
        icon: output.icon || 'mdi:power-socket',
        confirm: output.confirm === true,
      })),
    };
    this._confirm = null;
    this._signature = null;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const signature = this._signatureOf(hass);
    if (signature === this._signature) return;
    this._signature = signature;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  _signatureOf(hass) {
    if (!this._config || !hass) return '';
    const ids = [
      this._config.battery, this._config.online, this._config.runtime,
      this._config.input_power, this._config.output_power, this._config.grid,
      ...this._config.outputs.map((output) => output.entity),
    ].filter(Boolean);
    const states = ids.map((id) => {
      const state = hass.states[id];
      return state ? `${state.state}~${state.last_updated}` : 'missing';
    });
    return `${langOf(hass)}|${this._confirm || ''}|${states.join('|')}`;
  }

  _online() {
    const entity = this._config.online;
    if (!entity) return true;
    return this._hass?.states[entity]?.state === 'on';
  }

  _gridOn() {
    const entity = this._config.grid;
    if (!entity) return false;
    return this._hass?.states[entity]?.state === 'on';
  }

  _level() {
    const percent = numeric(this._hass, this._config.battery);
    if (percent === null) return null;
    return Math.max(10, Math.min(100, Math.round(Math.max(0, Math.min(100, percent)) / 10) * 10));
  }

  _color(percent) {
    if (percent === null) return null;
    return percent < 30 ? '#f5576c' : percent < 60 ? '#f5a623' : '#2ecc71';
  }

  _batteryIcon(online, level, charging) {
    if (!online) return 'mdi:battery-off-outline';
    if (level === null) return 'mdi:battery-unknown';
    if (charging) return level >= 100 ? 'mdi:battery-charging-100' : `mdi:battery-charging-${level}`;
    return level >= 100 ? 'mdi:battery' : `mdi:battery-${level}`;
  }

  _outputState(output, online) {
    const state = this._hass.states[output.entity]?.state;
    if (!online) return { label: STRINGS[langOf(this._hass)].away, cls: 'away' };
    if (state === 'on') return { label: STRINGS[langOf(this._hass)].on, cls: 'on' };
    if (state === 'unavailable' || state === 'unknown') {
      return { label: STRINGS[langOf(this._hass)].unavailable, cls: 'off' };
    }
    return { label: STRINGS[langOf(this._hass)].off, cls: 'off' };
  }

  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass;
    const config = this._config;
    const L = STRINGS[langOf(hass)];
    const online = this._online();

    // The confirm question cannot outlive the state that asked it.
    if (this._confirm) {
      const output = config.outputs.find((item) => item.entity === this._confirm);
      if (!online || !output || hass.states[output.entity]?.state !== 'on') this._confirm = null;
    }

    const percent = numeric(hass, config.battery);
    const shown = percent === null ? null : Math.max(0, Math.min(100, percent));
    const level = this._level();
    const color = this._color(shown);
    const inPower = numeric(hass, config.input_power) ?? 0;
    const outPower = numeric(hass, config.output_power) ?? 0;
    const net = inPower - outPower;
    const runtime = numeric(hass, config.runtime);
    const charging = online && net > 5;

    const icon = this._batteryIcon(online, level, charging);
    const percentText = online && shown !== null ? `${Math.round(shown)} %` : '';

    const subBits = [];
    if (online && runtime !== null && runtime > 0 && outPower > 5) {
      subBits.push(`≈ ${runtime.toFixed(1)} ${L.hours}`);
    }
    if (charging) subBits.push(L.charging);
    const sub = online ? subBits.join(' · ') : L.offline;

    const iconStyle = online && color
      ? ` style="background:${color}22;color:${color}"`
      : '';
    const percentStyle = online && color ? ` style="color:${color}"` : '';

    const head = `
      <div class="head ${online ? '' : 'away'}" data-more="${escapeHtml(config.battery)}"
           role="button" tabindex="0" aria-label="${escapeHtml(`${config.name}. ${online ? percentText || '' : L.offline}. ${L.moreInfo}`)}">
        <div class="bico"${iconStyle}><ha-icon icon="${icon}"></ha-icon></div>
        <div class="meta">
          <div class="name">${escapeHtml(config.name)}</div>
          <div class="sub">${escapeHtml(sub)}</div>
        </div>
        ${percentText ? `<div class="pct"${percentStyle}>${percentText}</div>` : ''}
      </div>
      ${online && shown !== null && color
        ? `<div class="bar"><span style="width:${shown}%;background:${color}"></span></div>`
        : ''}
    `;

    let body;
    if (this._confirm) {
      const output = config.outputs.find((item) => item.entity === this._confirm);
      const question = L.confirm.replace('{name}', output.name);
      body = `
        <div class="confirm" role="group" aria-label="${escapeHtml(question)}">
          <div class="q">${escapeHtml(question)}</div>
          <div class="acts">
            <button type="button" class="no" data-cancel>${escapeHtml(L.cancel)}</button>
            <button type="button" class="yes" data-yes="${escapeHtml(output.entity)}">${escapeHtml(L.turnOff)}</button>
          </div>
        </div>
      `;
    } else {
      const buttons = config.outputs.map((output, index) => {
        const state = this._outputState(output, online);
        return `
          <button type="button" class="out ${state.cls}" data-out="${index}"
                  ${online ? '' : 'disabled'} aria-label="${escapeHtml(`${output.name}. ${state.label}`)}">
            <span class="oico"><ha-icon icon="${escapeHtml(output.icon)}"></ha-icon></span>
            <span class="otx"><span class="olabel">${escapeHtml(output.name)}</span><span class="ostate">${escapeHtml(state.label)}</span></span>
          </button>
        `;
      }).join('');
      body = `<div class="outs">${buttons}</div>`;
    }

    this._hub.innerHTML = `${head}<div class="sep">${body}</div>`;
  }

  _onClick(event) {
    if (!this._config || !this._hass) return;

    const yes = event.target.closest?.('[data-yes]');
    if (yes) {
      const entity = yes.getAttribute('data-yes');
      this._confirm = null;
      this._hass.callService('switch', 'turn_off', { entity_id: entity }).catch(() => {});
      this._signature = null;
      this._render();
      return;
    }

    if (event.target.closest?.('[data-cancel]')) {
      this._confirm = null;
      this._signature = null;
      this._render();
      return;
    }

    const head = event.target.closest?.('.head');
    if (head) {
      this._moreInfo(head.getAttribute('data-more'));
      return;
    }

    const button = event.target.closest?.('[data-out]');
    if (!button) return;
    if (!this._online()) return; // the lock: no state change while the station is away
    const index = Number(button.getAttribute('data-out'));
    const output = this._config.outputs[index];
    if (!output) return;

    const on = this._hass.states[output.entity]?.state === 'on';
    if (output.confirm && on && !this._gridOn()) {
      this._confirm = output.entity;
      this._signature = null;
      this._render();
      return;
    }
    this._hass.callService('switch', 'toggle', { entity_id: output.entity }).catch(() => {});
  }

  _onKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const head = event.target.closest?.('.head');
    if (!head || event.target !== head) return;
    event.preventDefault();
    this._moreInfo(head.getAttribute('data-more'));
  }

  _moreInfo(entity) {
    if (!entity) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entity },
      bubbles: true,
      composed: true,
    }));
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  static getStubConfig() {
    return {
      type: `custom:${TAG}`,
      name: 'Oukitel BP2000',
      battery: 'sensor.oukitel_battery',
      online: 'binary_sensor.oukitel_device_online',
      runtime: 'sensor.oukitel_runtime_estimate',
      input_power: 'sensor.oukitel_total_input_power',
      output_power: 'sensor.oukitel_total_output_power',
      grid: 'binary_sensor.grid_present_relay',
      outputs: [
        { entity: 'switch.oukitel_ac_output', name: 'AC 230V', icon: 'mdi:power-plug', confirm: true },
        { entity: 'switch.oukitel_usb_output', name: 'USB', icon: 'mdi:usb-port' },
        { entity: 'switch.oukitel_dc_12v_output', name: 'DC 12V', icon: 'mdi:car' },
      ],
    };
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, OukitelStationCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: TAG,
  name: 'Oukitel Station Card',
  description: 'One card for an Oukitel station: battery at the top, three outputs under it, locked while the station is away.',
  preview: true,
});

console.info(
  `%c OUKITEL-STATION-CARD %c ${VERSION} `,
  'color: white; font-weight: bold; background: #2e7d32',
  'color: #2e7d32; font-weight: bold; background: white',
);
