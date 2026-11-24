// Cảnh minh họa có chuyển động cho từng loại âm thanh (SVG + CSS, nhẹ, không cần tải ảnh).
// Muốn dùng ảnh/video thật: đặt file vào assets/media/sounds/ và khai báo trong manifest.json (xem README ở đó).

const bg = (id, a, b) => `<defs><radialGradient id="bg-${id}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><circle cx="120" cy="100" r="94" fill="url(#bg-${id})"/>`;
const wrap = (id, label, inner) => `<svg class="scene sc-${id}" viewBox="0 0 240 200" role="img" aria-label="${label}">${inner}</svg>`;
const arcs = (x, y, c = '#fff', dir = 1) => `<g class="sc-arcs" style="--d:${dir}"><path d="M${x} ${y - 14}a18 18 0 0 1 0 28" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" transform="scale(${dir} 1)" transform-origin="${x} ${y}"/><path d="M${x + 10 * dir} ${y - 24}a30 30 0 0 1 0 48" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7" transform="scale(${dir} 1)" transform-origin="${x + 10 * dir} ${y}"/></g>`;

export const SCENES = {
  dog: wrap('dog', 'Chú chó đang sủa', `${bg('dog', '#ffe2b8', '#f2a65a')}
    <ellipse cx="118" cy="182" rx="66" ry="7" fill="rgba(0,0,0,.18)"/>
    <g class="sc-wag"><path d="M162 128c20-6 28-24 22-40" stroke="#b9763d" stroke-width="12" stroke-linecap="round" fill="none"/></g>
    <path d="M72 122c0-24 22-36 46-36s46 12 46 38v28c0 14-10 22-22 22H94c-12 0-22-8-22-22z" fill="#d9944f"/>
    <path d="M94 150v26h14l-2-26zM136 150v26h14l-4-26z" fill="#b9763d"/>
    <path d="M98 130c4 10 32 10 36 0" fill="#f6dcb8"/>
    <g class="sc-bark">
      <path d="M60 72c0-28 24-44 52-44s52 16 52 44-24 48-52 48-52-20-52-48z" fill="#e3a462"/>
      <path d="M62 46c-16 4-24 28-18 46 6 6 16 2 20-6 2-14 6-28-2-40z" fill="#8a5428" class="sc-ear"/>
      <path d="M162 46c16 4 24 28 18 46-6 6-16 2-20-6-2-14-6-28 2-40z" fill="#8a5428" class="sc-ear r"/>
      <ellipse cx="112" cy="90" rx="30" ry="21" fill="#f6dcb8"/>
      <circle cx="90" cy="70" r="6.5" fill="#24170e"/><circle cx="132" cy="70" r="6.5" fill="#24170e"/>
      <circle cx="92" cy="68" r="2.2" fill="#fff"/><circle cx="134" cy="68" r="2.2" fill="#fff"/>
      <ellipse cx="112" cy="82" rx="9" ry="6.5" fill="#24170e"/>
      <path class="sc-jaw" d="M96 96c6 12 26 12 32 0z" fill="#7a2730"/>
      <path class="sc-jaw" d="M104 100c4 6 12 6 16 0z" fill="#ef6f7a"/>
    </g>
    <path d="M92 120h40" stroke="#d6453d" stroke-width="7" stroke-linecap="round"/><circle cx="112" cy="126" r="5" fill="#f2c14e"/>
    ${arcs(176, 74, '#fff')}
    <g class="sc-pop"><rect x="180" y="18" rx="10" width="50" height="28" fill="#fff"/><path d="M188 46l-4 10 12-10z" fill="#fff"/><text x="205" y="38" text-anchor="middle" font-size="14" font-weight="800" fill="#24170e">Gâu!</text></g>`),

  cat: wrap('cat', 'Chú mèo đang kêu', `${bg('cat', '#e4e6f5', '#9aa2c8')}
    <ellipse cx="118" cy="182" rx="60" ry="7" fill="rgba(0,0,0,.18)"/>
    <g class="sc-wag slow"><path d="M156 160c32 0 42-32 26-54" stroke="#7d8295" stroke-width="11" stroke-linecap="round" fill="none"/></g>
    <path d="M76 132c0-20 18-32 42-32s40 12 40 32v28c0 12-8 20-20 20H96c-12 0-20-8-20-20z" fill="#9ca2b5"/>
    <g class="sc-tilt">
      <path d="M66 40l22 22h58l22-22 4 48c0 28-26 46-56 46S62 116 62 88z" fill="#b2b8c9"/>
      <path d="M74 52l12 12M162 52l-12 12" stroke="#f1b7c3" stroke-width="6" stroke-linecap="round"/>
      <g class="sc-blink"><ellipse cx="96" cy="86" rx="7" ry="10" fill="#2b2f3a"/><ellipse cx="140" cy="86" rx="7" ry="10" fill="#2b2f3a"/>
      <circle cx="98" cy="83" r="2.5" fill="#fff"/><circle cx="142" cy="83" r="2.5" fill="#fff"/></g>
      <path d="M112 100h12l-6 6z" fill="#e98ea0"/>
      <ellipse class="sc-jaw" cx="118" cy="112" rx="6" ry="4" fill="#7a2730"/>
      <path d="M76 98l-24-4M76 104l-24 4M160 98l24-4M160 104l24 4" stroke="#6f7484" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g class="sc-pop"><rect x="174" y="16" rx="10" width="56" height="28" fill="#fff"/><path d="M182 44l-4 10 12-10z" fill="#fff"/><text x="202" y="35" text-anchor="middle" font-size="14" font-weight="800" fill="#2b2f3a">Meo~</text></g>`),

  bird: wrap('bird', 'Chú chim đang hót', `${bg('bird', '#d8f5ee', '#71c9b5')}
    <path d="M34 154c40-8 120-8 172 0" stroke="#8b6a45" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M60 152c-6-10-2-20 8-22M180 156c8-8 18-6 22 2" stroke="#4f8f4a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="sc-hop"><path d="M76 112c0-30 22-52 50-52 20 0 34 14 34 32 0 30-26 52-56 52-16 0-28-14-28-32z" fill="#3fa598"/>
      <path d="M90 114c10 18 40 20 52 0-8 20-44 24-52 0z" fill="#f2d16b"/>
      <path class="sc-flap" d="M98 98c12-14 34-14 44 4-16-2-30 0-44-4z" fill="#2e7e73"/>
      <circle cx="138" cy="82" r="6" fill="#1d2b2a"/><circle cx="140" cy="80" r="2" fill="#fff"/>
      <path class="sc-jaw" d="M158 86l20 6-20 6z" fill="#f29b38"/>
      <path d="M106 142v12M122 142v12" stroke="#f29b38" stroke-width="4" stroke-linecap="round"/></g>
    <g class="sc-notes"><g><path d="M184 66V44l14-4v22" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="180" cy="66" r="5" fill="#fff"/><circle cx="194" cy="62" r="5" fill="#fff"/></g>
      <g><path d="M200 40V24" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="196" cy="40" r="5" fill="#fff"/></g></g>`),

  speech: wrap('speech', 'Người đang nói chuyện', `${bg('speech', '#d7e6ff', '#6f97e8')}
    <ellipse cx="96" cy="184" rx="56" ry="6" fill="rgba(0,0,0,.18)"/>
    <path d="M52 184c0-34 20-54 44-54s44 20 44 54z" fill="#2f4b8a"/>
    <path d="M84 130l12 16 12-16" fill="#fff"/>
    <rect x="86" y="112" width="20" height="22" rx="8" fill="#f1c19c"/>
    <g class="sc-nod"><circle cx="96" cy="84" r="34" fill="#f6cfaa"/>
      <path d="M62 82c0-26 16-40 36-40 22 0 36 14 34 40-4-12-14-20-34-20s-30 6-36 20z" fill="#2c2018"/>
      <g class="sc-blink"><circle cx="84" cy="88" r="3.6" fill="#24170e"/><circle cx="110" cy="88" r="3.6" fill="#24170e"/></g>
      <path d="M78 78l10-2M104 76l10 2" stroke="#2c2018" stroke-width="3" stroke-linecap="round"/>
      <ellipse class="sc-talk" cx="97" cy="104" rx="8" ry="5" fill="#8b2c35"/>
      <circle cx="74" cy="98" r="5" fill="#f29a8c" opacity=".5"/><circle cx="120" cy="98" r="5" fill="#f29a8c" opacity=".5"/></g>
    <g class="sc-bubble"><rect x="140" y="30" rx="16" width="84" height="46" fill="#fff"/><path d="M150 76l-12 14 22-14z" fill="#fff"/>
      <g class="sc-dots"><circle cx="164" cy="53" r="5" fill="#6f97e8"/><circle cx="182" cy="53" r="5" fill="#6f97e8"/><circle cx="200" cy="53" r="5" fill="#6f97e8"/></g></g>
    <g class="sc-bubble b2"><rect x="156" y="96" rx="12" width="60" height="30" fill="#ffffffcc"/><path d="M168 106h36M168 116h22" stroke="#6f97e8" stroke-width="4" stroke-linecap="round"/></g>`),

  crowd: wrap('crowd', 'Đám đông đang reo hò vỗ tay', `${bg('crowd', '#ffe1ec', '#e07aa0')}
    ${[[44, '#f6cfaa', '#4a3628', '#5b8def'], [92, '#e9b48e', '#1f1712', '#f2a541'], [140, '#f3c7a3', '#6b3b22', '#3fa598'], [188, '#d9a07a', '#2c2018', '#9b6ef0']].map(([x, sk, hair, sh], i) => `
    <g class="sc-bob" style="animation-delay:${i * 0.18}s">
      <path d="M${x - 26} 190c0-28 12-44 26-44s26 16 26 44z" fill="${sh}"/>
      <circle cx="${x}" cy="${118 - (i % 2) * 8}" r="19" fill="${sk}"/>
      <path d="M${x - 19} ${116 - (i % 2) * 8}c0-14 8-22 19-22s19 8 19 22c-6-8-12-10-19-10s-13 2-19 10z" fill="${hair}"/>
      <ellipse cx="${x}" cy="${126 - (i % 2) * 8}" rx="5" ry="4" fill="#7a2730"/>
      <g class="sc-clap" style="animation-delay:${i * 0.12}s"><circle cx="${x - 12}" cy="${150 - (i % 2) * 6}" r="6" fill="${sk}"/><circle cx="${x + 12}" cy="${150 - (i % 2) * 6}" r="6" fill="${sk}"/></g>
    </g>`).join('')}
    <g class="sc-confetti">${Array.from({ length: 10 }, (_, i) => `<rect x="${30 + i * 19}" y="20" width="6" height="10" rx="2" fill="${['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#fff'][i % 5]}" style="animation-delay:${(i % 5) * 0.3}s"/>`).join('')}</g>`),

  baby: wrap('baby', 'Em bé đang khóc', `${bg('baby', '#fff0d9', '#f7b4a7')}
    <ellipse cx="120" cy="184" rx="58" ry="7" fill="rgba(0,0,0,.15)"/>
    <path d="M68 186c0-38 24-56 52-56s52 18 52 56z" fill="#9bd0f5"/>
    <g class="sc-shake"><circle cx="120" cy="92" r="46" fill="#ffd9bd"/>
      <path d="M112 48c4-8 14-8 16 0-4-2-10-2-16 0z" fill="#c98a4b"/>
      <path d="M92 86c6 4 12 4 18 0M130 86c6 4 12 4 18 0" stroke="#3b2a20" stroke-width="4" stroke-linecap="round" fill="none"/>
      <ellipse class="sc-cry" cx="120" cy="114" rx="13" ry="10" fill="#8b2c35"/>
      <circle cx="90" cy="104" r="7" fill="#f6a3a0" opacity=".6"/><circle cx="150" cy="104" r="7" fill="#f6a3a0" opacity=".6"/>
      <path class="sc-tear" d="M98 92c-4 8-4 12 0 14 4-2 4-6 0-14z" fill="#59b7ff"/>
      <path class="sc-tear t2" d="M142 92c-4 8-4 12 0 14 4-2 4-6 0-14z" fill="#59b7ff"/></g>
    <g class="sc-pop"><text x="196" y="52" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">Oa oa!</text></g>`),

  children: wrap('children', 'Trẻ em vui chơi', `${bg('kids', '#fff3c4', '#f2c14e')}
    <ellipse cx="120" cy="186" rx="80" ry="7" fill="rgba(0,0,0,.15)"/>
    <g class="sc-jump"><circle cx="82" cy="70" r="20" fill="#f4c7a1"/><path d="M62 66c0-14 10-22 20-22s22 8 20 22c-6-6-14-8-20-8s-14 2-20 8z" fill="#3b2a20"/>
      <path d="M74 78c4 5 12 5 16 0" stroke="#2b1d12" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="75" cy="70" r="2.5" fill="#2b1d12"/><circle cx="89" cy="70" r="2.5" fill="#2b1d12"/>
      <path d="M66 94h32l6 48H60z" fill="#5b8def"/><path d="M66 100l-20-22M98 100l20-22" stroke="#f4c7a1" stroke-width="7" stroke-linecap="round"/>
      <path d="M70 142l-6 34M94 142l6 34" stroke="#2f3b55" stroke-width="8" stroke-linecap="round"/></g>
    <g class="sc-jump d2"><circle cx="156" cy="80" r="18" fill="#f0bf95"/><path d="M138 78c0-14 8-20 18-20s20 6 18 20l-4-6c-6 2-20 2-28 6z" fill="#7a4a2b"/>
      <ellipse cx="156" cy="90" rx="4" ry="3" fill="#2b1d12"/><circle cx="150" cy="80" r="2.5" fill="#2b1d12"/><circle cx="162" cy="80" r="2.5" fill="#2b1d12"/>
      <path d="M140 102h32l8 44h-48z" fill="#ef5d68"/><path d="M142 108l-18 18M170 108l20-20" stroke="#f0bf95" stroke-width="7" stroke-linecap="round"/>
      <path d="M146 146v30M166 146v30" stroke="#2f3b55" stroke-width="8" stroke-linecap="round"/></g>
    <g class="sc-ball"><circle cx="200" cy="56" r="12" fill="#fff"/><path d="M190 50c6 4 14 4 20 0" stroke="#ef5d68" stroke-width="3" fill="none"/></g>`),

  rain: wrap('rain', 'Mưa giông, sấm sét', `${bg('rain', '#5d6b8a', '#1f2740')}
    <rect class="sc-flash" x="0" y="0" width="240" height="200" fill="#fff"/>
    <g class="sc-drift"><path d="M52 92a30 30 0 0 1 28-34 40 40 0 0 1 76-8 30 30 0 0 1 36 30 22 22 0 0 1-8 42H62a22 22 0 0 1-10-30z" fill="#c9d3e8"/>
      <path d="M70 110a24 24 0 0 1 22-26 32 32 0 0 1 60-4 24 24 0 0 1 26 24 16 16 0 0 1-6 32H80a16 16 0 0 1-10-26z" fill="#9aa8c7"/></g>
    <path class="sc-bolt" d="M126 118l-22 34h18l-12 36 34-46h-20l14-24z" fill="#ffd84d" stroke="#fff3a6" stroke-width="2"/>
    <g class="sc-drops">${Array.from({ length: 12 }, (_, i) => `<path d="M${46 + i * 14} ${134 + (i % 3) * 10}l-4 12" stroke="#9fd0ff" stroke-width="3" stroke-linecap="round" style="animation-delay:${(i % 4) * 0.15}s"/>`).join('')}</g>`),

  water: wrap('water', 'Nước chảy', `${bg('water', '#d6f2ff', '#4aa8e0')}
    <path d="M70 40h40v20H70z" fill="#9aa4b1"/><path d="M110 46h30v8h-30z" fill="#9aa4b1"/>
    <path class="sc-pour" d="M132 54c0 30 0 60 0 92" stroke="#bfe8ff" stroke-width="12" stroke-linecap="round"/>
    <g class="sc-ripple"><ellipse cx="132" cy="158" rx="20" ry="5" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="132" cy="158" rx="20" ry="5" fill="none" stroke="#fff" stroke-width="3" style="animation-delay:.6s"/></g>
    <path d="M40 160c20-8 40 8 60 0s40 8 60 0 40 8 60 0v30H40z" fill="#2f86c2" opacity=".85" class="sc-wave"/>`),

  siren: wrap('siren', 'Xe cứu thương hú còi', `${bg('siren', '#ffd6d6', '#d94b4b')}
    <g class="sc-beam"><path d="M96 70L10 20v70z" fill="#ff5b5b" opacity=".35"/><path d="M144 70l86-50v70z" fill="#5b9bff" opacity=".35"/></g>
    <g class="sc-drive">
      <path d="M38 104h104l26 20h34v40H38z" fill="#fff"/><path d="M142 104l26 20h-26z" fill="#bfe3ff"/>
      <path d="M38 146h164" stroke="#e53e3e" stroke-width="8"/>
      <path d="M78 116h8v24h-8zM70 124h24v8H70z" fill="#e53e3e"/>
      <rect x="90" y="88" width="16" height="16" rx="4" fill="#ff3b3b" class="sc-lamp"/><rect x="108" y="88" width="16" height="16" rx="4" fill="#3b82ff" class="sc-lamp b"/>
      <circle cx="74" cy="166" r="14" fill="#2b2f3a"/><circle cx="74" cy="166" r="6" fill="#9aa4b1"/><circle cx="170" cy="166" r="14" fill="#2b2f3a"/><circle cx="170" cy="166" r="6" fill="#9aa4b1"/></g>
    ${arcs(212, 128, '#fff')}`),

  horn: wrap('horn', 'Còi xe inh ỏi', `${bg('horn', '#fff0c2', '#f2a541')}
    <g class="sc-shake"><path d="M40 118l18-34h86l20 34h28v42H40z" fill="#ef5d68"/><path d="M66 90h34v28H58zM108 90h32l14 28h-46z" fill="#cfe9ff"/>
    <circle cx="74" cy="162" r="15" fill="#2b2f3a"/><circle cx="74" cy="162" r="6" fill="#9aa4b1"/><circle cx="160" cy="162" r="15" fill="#2b2f3a"/><circle cx="160" cy="162" r="6" fill="#9aa4b1"/>
    <rect x="186" y="124" width="10" height="10" rx="3" fill="#ffe27a"/></g>
    ${arcs(204, 128, '#fff')}
    <g class="sc-pop"><text x="120" y="52" text-anchor="middle" font-size="24" font-weight="900" fill="#fff" letter-spacing="2">BÍP BÍP!</text></g>`),

  traffic: wrap('traffic', 'Xe cộ trên đường', `${bg('traffic', '#e0e6ee', '#7d8ba1')}
    <path d="M0 160h240v40H0z" fill="#4b5566"/><path class="sc-lane" d="M-20 178h40M40 178h40M100 178h40M160 178h40M220 178h40" stroke="#fff" stroke-width="4"/>
    <g class="sc-drive"><path d="M44 140l14-26h64l18 26h22v26H44z" fill="#3b82ff"/><path d="M64 118h24v22H58zM96 118h22l12 22H96z" fill="#cfe9ff"/>
    <circle cx="74" cy="166" r="12" fill="#2b2f3a"/><circle cx="144" cy="166" r="12" fill="#2b2f3a"/></g>
    <g class="sc-puff"><circle cx="36" cy="156" r="6" fill="#fff" opacity=".6"/><circle cx="24" cy="150" r="8" fill="#fff" opacity=".4"/></g>`),

  motorbike: wrap('motorbike', 'Xe máy chạy qua', `${bg('moto', '#e6f0ff', '#7a9cd6')}
    <path d="M0 168h240v32H0z" fill="#4b5566"/>
    <g class="sc-drive"><circle cx="78" cy="160" r="20" fill="none" stroke="#2b2f3a" stroke-width="9"/><circle cx="166" cy="160" r="20" fill="none" stroke="#2b2f3a" stroke-width="9"/>
    <path d="M78 160l30-36h40l18 36M112 124h-14" stroke="#ef5d68" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M100 116c10-6 34-6 44 0v12h-44z" fill="#ef5d68"/>
    <circle cx="128" cy="76" r="16" fill="#f2c14e"/><path d="M114 74h28" stroke="#1d2b2a" stroke-width="5"/>
    <path d="M128 92l-6 28 24 4" stroke="#2f4b8a" stroke-width="10" stroke-linecap="round" fill="none"/></g>
    <g class="sc-puff"><circle cx="44" cy="150" r="7" fill="#fff" opacity=".6"/><circle cx="28" cy="142" r="10" fill="#fff" opacity=".4"/></g>`),

  gunshot: wrap('gunshot', 'Tiếng nổ lớn', `${bg('boom', '#ffe0c2', '#d9534f')}
    <g class="sc-burst"><path d="M120 28l14 40 42-16-24 36 40 20-44 6 8 44-36-26-36 26 8-44-44-6 40-20-24-36 42 16z" fill="#ffd84d"/>
    <path d="M120 58l8 24 26-10-14 22 24 12-26 4 4 26-22-16-22 16 4-26-26-4 24-12-14-22 26 10z" fill="#ff7a2e"/></g>
    <g class="sc-pop"><text x="120" y="112" text-anchor="middle" font-size="26" font-weight="900" fill="#fff">BÙM!</text></g>
    <g class="sc-sparks">${Array.from({ length: 8 }, (_, i) => `<circle cx="120" cy="100" r="4" fill="#fff3a6" style="--a:${i * 45}deg"/>`).join('')}</g>`),

  fireworks: wrap('fireworks', 'Pháo hoa', `${bg('fw', '#3a3f7a', '#141633')}
    ${[[80, 70, '#ffd166', 0], [160, 60, '#ef476f', 0.5], [124, 118, '#06d6a0', 1]].map(([x, y, c, d]) => `<g class="sc-fw" style="animation-delay:${d}s;transform-origin:${x}px ${y}px">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${x} ${y}l${(Math.cos(a) * 30).toFixed(1)} ${(Math.sin(a) * 30).toFixed(1)}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="5" fill="#fff"/></g>`).join('')}
    <path d="M0 176h240v24H0z" fill="#0b0d1f"/><path d="M20 176v-20h16v20M60 176v-34h20v34M180 176v-28h18v28M206 176v-16h14v16" fill="#1b1f40"/>`),

  alarm: wrap('alarm', 'Chuông báo động đang reo', `${bg('alarm', '#ffd9d0', '#e5533d')}
    <g class="sc-ring"><circle cx="120" cy="96" r="52" fill="#e53e3e"/><circle cx="120" cy="96" r="40" fill="#ff6b5b"/>
    <circle cx="120" cy="96" r="10" fill="#fff"/><path d="M120 152v18" stroke="#9aa4b1" stroke-width="8"/>
    <path d="M86 52l-18-18M154 52l18-18" stroke="#e53e3e" stroke-width="8" stroke-linecap="round"/></g>
    ${arcs(184, 96, '#fff')}${arcs(56, 96, '#fff', -1)}
    <rect x="70" y="172" width="100" height="14" rx="7" fill="#7a1f1f" opacity=".5"/>`),

  glass: wrap('glass', 'Kính vỡ', `${bg('glass', '#e3f6ff', '#7cc3e6')}
    <rect x="58" y="34" width="124" height="132" rx="6" fill="#bfe8ff" stroke="#fff" stroke-width="6"/>
    <path class="sc-crack" d="M120 100l-26-40M120 100l40-30M120 100l34 44M120 100l-40 30M120 100l-6 60M120 100l50 4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <g class="sc-shards"><path d="M100 150l10-6 4 12z" fill="#fff"/><path d="M140 156l12-2-4 12z" fill="#fff"/><path d="M84 138l8 2-6 8z" fill="#fff"/><path d="M160 140l8 6-10 4z" fill="#fff"/></g>
    <g class="sc-pop"><text x="198" y="40" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">Choang!</text></g>`),

  fire: wrap('fire', 'Lửa cháy', `${bg('fire', '#ffe3b8', '#e8662e')}
    <path d="M70 172h100" stroke="#6b3b22" stroke-width="12" stroke-linecap="round"/><path d="M80 162l80 16M80 178l80-16" stroke="#8a5428" stroke-width="10" stroke-linecap="round"/>
    <g class="sc-flame"><path d="M120 30c10 30 44 46 44 88a44 44 0 0 1-88 0c0-26 18-36 22-58 8 14 14 18 22 22 4-20 0-36 0-52z" fill="#ff7a2e"/></g>
    <g class="sc-flame f2"><path d="M120 76c6 18 26 28 26 52a26 26 0 0 1-52 0c0-14 10-20 12-32 6 8 8 10 14 12 2-12 0-20 0-32z" fill="#ffd84d"/></g>
    <g class="sc-sparks up">${Array.from({ length: 6 }, (_, i) => `<circle cx="${96 + i * 10}" cy="60" r="2.5" fill="#fff3a6" style="animation-delay:${i * 0.25}s"/>`).join('')}</g>`),

  construction: wrap('construction', 'Công trường, máy khoan', `${bg('cons', '#fff1c7', '#e2a03f')}
    <path d="M30 176h180v12H30z" fill="#7a5a3a"/>
    <g class="sc-vibe"><rect x="98" y="40" width="44" height="64" rx="10" fill="#f2c14e"/><rect x="104" y="52" width="32" height="10" rx="4" fill="#2b2f3a"/>
    <path d="M110 104h20v24h-20z" fill="#5b6475"/><path d="M116 128h8v40h-8z" fill="#9aa4b1"/><path d="M114 168h12l-6 10z" fill="#9aa4b1"/>
    <path d="M86 60h12M142 60h12" stroke="#2b2f3a" stroke-width="8" stroke-linecap="round"/></g>
    <g class="sc-dust"><circle cx="100" cy="172" r="8" fill="#d9b98a"/><circle cx="142" cy="170" r="10" fill="#d9b98a"/><circle cx="120" cy="166" r="6" fill="#e8d0a8"/></g>
    <path d="M36 60l20-24 20 24z" fill="#ff7a2e"/><path d="M42 54h28" stroke="#fff" stroke-width="4"/>`),

  music: wrap('music', 'Âm nhạc', `${bg('music', '#efe1ff', '#9b6ef0')}
    <g class="sc-pulse"><rect x="74" y="54" width="92" height="124" rx="16" fill="#2b2f3a"/>
    <circle cx="120" cy="140" r="28" fill="#4a5060"/><circle cx="120" cy="140" r="14" fill="#1d2027" class="sc-cone"/>
    <circle cx="120" cy="84" r="14" fill="#4a5060"/><circle cx="120" cy="84" r="6" fill="#1d2027"/></g>
    <g class="sc-notes"><g><path d="M46 80V52l18-4v28" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="42" cy="80" r="6" fill="#fff"/><circle cx="60" cy="76" r="6" fill="#fff"/></g>
    <g><path d="M190 64V40" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="186" cy="64" r="6" fill="#fff"/><path d="M190 40l10 6" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
    <g><path d="M200 130v-22" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/><circle cx="196" cy="130" r="5" fill="#ffd166"/></g></g>`),

  wind: wrap('wind', 'Gió thổi', `${bg('wind', '#e6f7f3', '#83c7b8')}
    <g class="sc-gust"><path d="M30 80h120a18 18 0 1 0-18-18" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M40 112h150a16 16 0 1 1-16 16" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M24 142h90" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6"/></g>
    <g class="sc-leaf"><path d="M180 60c20-10 34 4 30 20-18 6-32-4-30-20z" fill="#4f8f4a"/><path d="M182 62l26 16" stroke="#2e5e2b" stroke-width="2"/></g>`),

  bell: wrap('bell', 'Chuông đang reo', `${bg('bell', '#fff4cf', '#f2c14e')}
    <g class="sc-ring"><rect x="82" y="36" width="76" height="128" rx="16" fill="#2b2f3a"/><rect x="90" y="48" width="60" height="96" rx="6" fill="#86e3ce"/>
    <circle cx="120" cy="96" r="18" fill="#fff"/><path d="M112 92a8 8 0 0 1 16 0v8h4v4h-24v-4h4z" fill="#f2a541"/><circle cx="120" cy="108" r="3" fill="#f2a541"/>
    <circle cx="120" cy="154" r="5" fill="#4a5060"/></g>
    ${arcs(172, 96, '#fff')}${arcs(68, 96, '#fff', -1)}`),

  door: wrap('door', 'Có người gõ cửa', `${bg('door', '#f4e4d4', '#c08a5c')}
    <rect x="76" y="30" width="88" height="150" rx="6" fill="#8a5428"/><rect x="86" y="42" width="68" height="56" rx="4" fill="#a86b38"/><rect x="86" y="108" width="68" height="60" rx="4" fill="#a86b38"/>
    <circle cx="150" cy="112" r="6" fill="#f2c14e"/>
    <g class="sc-knock"><path d="M178 70c10 0 16 6 16 14v18c0 6-6 10-12 10h-8c-6 0-10-4-10-10V82c0-8 6-12 14-12z" fill="#f4c7a1"/></g>
    <g class="sc-pop"><path d="M166 54l-8-8M172 50v-12M178 54l8-8" stroke="#fff" stroke-width="4" stroke-linecap="round"/><text x="206" y="150" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">Cốc cốc</text></g>`),

  aircraft: wrap('aircraft', 'Máy bay bay qua', `${bg('plane', '#dff0ff', '#6fb1e8')}
    <g class="sc-cloud"><path d="M30 150a14 14 0 0 1 14-14 20 20 0 0 1 38 0 12 12 0 0 1 0 24H44a14 14 0 0 1-14-10z" fill="#fff" opacity=".9"/></g>
    <g class="sc-fly"><path d="M50 104l120-8c14 0 20 6 20 10s-6 10-20 10l-120-8z" fill="#fff"/><path d="M110 98l-30-40h14l40 40zM110 114l-30 36h14l40-36z" fill="#e1e8f2"/>
    <path d="M56 104l-14-22h10l18 20z" fill="#ef5d68"/><circle cx="160" cy="104" r="3" fill="#6fb1e8"/><circle cx="148" cy="104" r="3" fill="#6fb1e8"/><circle cx="136" cy="104" r="3" fill="#6fb1e8"/></g>
    <path class="sc-trail" d="M20 108h40" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`),

  train: wrap('train', 'Tàu hỏa chạy qua', `${bg('train', '#e8f1e4', '#86b07a')}
    <path d="M0 172h240" stroke="#6b4f35" stroke-width="6"/><path class="sc-lane" d="M-10 180h20M30 180h20M70 180h20M110 180h20M150 180h20M190 180h20M230 180h20" stroke="#8a6a45" stroke-width="8"/>
    <g class="sc-drive"><rect x="40" y="88" width="150" height="70" rx="14" fill="#ef5d68"/><path d="M190 100h16c8 0 12 8 12 16v42h-28z" fill="#d94b4b"/>
    <rect x="54" y="100" width="30" height="24" rx="4" fill="#cfe9ff"/><rect x="94" y="100" width="30" height="24" rx="4" fill="#cfe9ff"/><rect x="134" y="100" width="30" height="24" rx="4" fill="#cfe9ff"/>
    <circle cx="70" cy="162" r="11" fill="#2b2f3a"/><circle cx="120" cy="162" r="11" fill="#2b2f3a"/><circle cx="170" cy="162" r="11" fill="#2b2f3a"/>
    <rect x="200" y="108" width="12" height="12" rx="3" fill="#ffe27a"/></g>`),

  ac: wrap('ac', 'Quạt, máy lạnh chạy', `${bg('ac', '#e4f4ff', '#8fc3e3')}
    <g class="sc-spin"><circle cx="120" cy="96" r="56" fill="none" stroke="#fff" stroke-width="6"/>
    ${[0, 120, 240].map((a) => `<path d="M120 96c-4-26 8-44 22-46 8 18-4 36-22 46z" fill="#5b9bd5" transform="rotate(${a} 120 96)"/>`).join('')}
    <circle cx="120" cy="96" r="10" fill="#2b2f3a"/></g>
    <path d="M120 152v26M96 180h48" stroke="#9aa4b1" stroke-width="8" stroke-linecap="round"/>
    <g class="sc-gust"><path d="M186 70h30M190 96h36M186 122h30" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>`),

  laugh: wrap('laugh', 'Tiếng cười', `${bg('laugh', '#fff3c4', '#f7c948')}
    <g class="sc-bob"><circle cx="120" cy="100" r="62" fill="#ffd84d"/>
    <path d="M86 84c6-8 16-8 22 0M132 84c6-8 16-8 22 0" stroke="#5a3d10" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path class="sc-talk" d="M82 108c10 34 66 34 76 0z" fill="#8b2c35"/><path d="M90 110h60" stroke="#fff" stroke-width="6"/>
    <path class="sc-tear" d="M76 90c-6 10-6 16 0 18 6-2 6-8 0-18z" fill="#59b7ff"/></g>
    <g class="sc-pop"><text x="200" y="44" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">Haha!</text></g>`),

  footsteps: wrap('footsteps', 'Tiếng bước chân', `${bg('steps', '#ece7e0', '#b8a48a')}
    ${[[70, 150, -10], [100, 120, 10], [130, 96, -10], [160, 70, 10], [190, 46, -10]].map(([x, y, r], i) => `<g class="sc-step" style="animation-delay:${i * 0.35}s"><ellipse cx="${x}" cy="${y}" rx="10" ry="16" fill="#5a4632" transform="rotate(${r} ${x} ${y})"/><circle cx="${x - 6}" cy="${y - 20}" r="3" fill="#5a4632"/><circle cx="${x + 2}" cy="${y - 22}" r="3" fill="#5a4632"/><circle cx="${x + 9}" cy="${y - 19}" r="3" fill="#5a4632"/></g>`).join('')}`),

  poultry: wrap('poultry', 'Gà gáy', `${bg('poultry', '#fff0d0', '#f2a541')}
    <ellipse cx="120" cy="182" rx="56" ry="7" fill="rgba(0,0,0,.15)"/>
    <g class="sc-crow"><path d="M84 128c0-30 22-48 48-48 26 0 42 18 42 42 0 30-24 48-52 48s-38-18-38-42z" fill="#fff"/>
    <path d="M70 110c-20-10-30 10-20 30 10-4 18-12 20-30z" fill="#e53e3e"/><path d="M60 96c-14-4-20 12-10 22" fill="#2e7e73"/>
    <circle cx="150" cy="70" r="20" fill="#fff"/><path d="M144 50c0-10 8-12 10-4 2-8 10-6 10 2 4-4 10 0 6 6z" fill="#e53e3e"/>
    <circle cx="154" cy="66" r="3.5" fill="#1d2b2a"/><path class="sc-jaw" d="M168 70l16 4-16 6z" fill="#f29b38"/><path d="M160 82c0 10 6 12 6 4z" fill="#e53e3e"/>
    <path d="M116 168v14M132 168v14" stroke="#f29b38" stroke-width="4" stroke-linecap="round"/></g>
    <g class="sc-pop"><text x="202" y="40" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">Ò ó o!</text></g>`),
};

// Nhóm dùng chung cảnh
Object.assign(SCENES, {
  shout: SCENES.speech, tv: SCENES.music, insect: SCENES.bird, animal: SCENES.dog, livestock: SCENES.poultry,
  boat: SCENES.water, engine: SCENES.traffic, office: SCENES.speech, appliance: SCENES.ac,
});

// ------------------------------------------------------------------ Ảnh/video thật (tuỳ chọn)
let manifest = null;
async function loadManifest() {
  if (manifest) return manifest;
  try { const r = await fetch('assets/media/sounds/manifest.json', { cache: 'no-cache' }); manifest = r.ok ? await r.json() : {}; } catch { manifest = {}; }
  return manifest;
}
loadManifest();

/** HTML minh họa cho nhóm `id` – ưu tiên ảnh/video thật nếu nhóm đã khai báo trong manifest. */
export function sceneFor(id) {
  const m = manifest?.[id];
  if (m?.file) {
    const src = `assets/media/sounds/${encodeURI(m.file)}`;
    const credit = m.credit ? `<small class="media-credit">${m.credit.replace(/[<>&]/g, '')}</small>` : '';
    return /\.(mp4|webm)$/i.test(m.file)
      ? `<div class="scene-media"><video src="${src}" autoplay loop muted playsinline></video>${credit}</div>`
      : `<div class="scene-media"><img src="${src}" alt="" loading="lazy">${credit}</div>`;
  }
  return SCENES[id] || null;
}
