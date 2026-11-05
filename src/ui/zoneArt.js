import { escapeHTML } from './components.js';

const path = (fill, d, extra = '') => `<path fill="${fill}" d="${d}"${extra}/>`;
const stroke = (color, width, d, opacity = 1) => path('none', d, ` stroke="${color}" stroke-width="${width}" opacity="${opacity}"`);

const SKY = [
  path('#0c1928', 'M0 0h800v260H0Z'),
  path('#172b40', 'm0 0 800 0v68l-89-21-92 29-113-45-97 34-116-43-105 39L0 35Z'),
  path('#21394d', 'm0 91 89-32 77 24 88-43 105 35 92-28 97 39 102-31 150 42v56H0Z'),
  stroke('#8cb4c9', 3, 'm72 39-18 32 20-5-24 40M690 34l-17 30 18-4-22 37', .65),
  path('#101e2e', 'm0 196 81-34 86 24 97-48 91 45 105-33 92 39 110-42 138 49v64H0Z'),
];

const VISTAS = {
  greyhaven: {
    name: 'Greyhaven', caption: 'Lanterns beneath the eastern ridge',
    description: 'Angular cottages and a brass beacon overlook Greyhaven’s rain-swept cobbled square.',
    paths: [
      path('#263f50', 'm0 198 99-46 91 38 89-27 93 32 96-52 112 48 96-34 124 43v60H0Z'),
      path('#111e2b', 'm52 148 66-47 72 47v70H52Zm236 14 54-39 59 39v56h-113Zm314-22 60-43 65 43v78H602Z'),
      path('#426074', 'm42 149 76-57 82 57-15 12-67-44-65 44Zm235 14 65-49 70 49-12 11-58-37-54 38Zm313-21 72-54 76 54-13 12-63-41-61 42Z'),
      path('#e9c66f', 'm80 166 20-13 20 13v26H80Zm241 9 17-11 18 11v22h-35Zm314-16 19-12 20 12v25h-39Z'),
      stroke('#8ea9b7', 4, 'm9 224 192-11 182 12 202-10 206 12', .55),
    ],
  },
  ridge_road: {
    name: 'Ridge Road', caption: 'Switchbacks above the storm chasm',
    description: 'A pale zigzag trail climbs between sheer angular cliffs beneath forked lightning.',
    paths: [
      path('#263c4e', 'm0 88 120 46 79 72 98 54H0Zm800-24-125 57-82 78-119 61h326Z'),
      path('#385468', 'm0 134 92 21 86 59 107 46H0Zm800-9-112 33-91 57-115 45h318Z'),
      path('#09131f', 'm239 260 65-92 93-48 85 21 76 119Z'),
      stroke('#c2b88f', 12, 'm111 260 155-51-86-38 202-39-84-36 177-51'),
      stroke('#eef0cf', 3, 'm111 260 155-51-86-38 202-39-84-36 177-51', .7),
      stroke('#9fc5d7', 4, 'm531 17-35 51 30-8-43 58', .85),
    ],
  },
  observatory_ruins: {
    name: 'Observatory Ruins', caption: 'The broken dome and focusing lens',
    description: 'Segmented brass arches and shattered observatory walls frame a luminous lens in the ruins.',
    paths: [
      path('#2b4356', 'm0 206 128-43 98 30 114-52 108 49 106-28 112 39 134-24v83H0Z'),
      path('#172737', 'm174 218 22-105 45-23 21-58 38-18 37 20 17 54 48 29 24 101Z'),
      stroke('#b79251', 10, 'm190 129 31-79 60-39 64 20 50 62 25 70'),
      stroke('#d2b56f', 4, 'm216 135 20-60 48-31 49 16 38 50 19 52'),
      path('#0c1928', 'm256 218 11-91 45-38 47 38 12 91Z'),
      path('#f1d47f', 'm288 142 25-19 25 19-8 36h-34Z'),
      path('#385367', 'm58 223 18-82 64-22 47 26 9 78Zm469 0 16-71 52-31 73 28 20 74Z'),
      stroke('#829fb0', 5, 'm62 180 68 15 56-19M535 180l67-18 74 23', .6),
    ],
  },
  beacon_tower: {
    name: 'Beacon Tower', caption: 'A cold light above the cloud line',
    description: 'The tall bronze beacon housing rises from a cliff with geometric rays reaching into the storm.',
    paths: [
      path('#2b4356', 'm0 215 118-47 106 36 104-45 95 39 104-51 113 52 160-32v93H0Z'),
      path('#172838', 'm328 260 28-174h88l29 174Z'),
      path('#4b5960', 'm342 260 23-165h70l23 165Z'),
      path('#b08b4c', 'm325 90 22-38h106l22 38-19 22H345Z'),
      path('#f2d783', 'm368 62 32-20 33 20-8 37h-50Z'),
      path('#e8c76f', 'm348 49-161-35 169 54Zm105-4 162-37-154 58Z', ' opacity=".32"'),
      stroke('#9a7c4a', 5, 'm356 145 88 0M350 183h99M343 222h113'),
      stroke('#d9bd70', 4, 'm400 24 0-24M324 43l-38-38M476 43l39-38', .7),
    ],
  },
  saltmere_coast: {
    name: 'Saltmere Coast', caption: 'Boardwalks above the tidal cove',
    description: 'Storm-battered cottages and a timber boardwalk stand over layered angular waves in Saltmere.',
    paths: [
      path('#24465a', 'm0 174 93-23 84 30 97-29 93 31 104-30 101 32 98-28 130 30v73H0Z'),
      path('#3f6c7c', 'm0 205 97-24 90 27 99-25 91 27 105-25 97 27 99-25 122 28v45H0Z'),
      path('#152b38', 'm69 125 68-47 72 47v62H69Zm475-6 61-42 66 42v63H544Z'),
      path('#587180', 'm58 126 79-58 82 58-14 12-68-43-67 43Zm475-6 72-53 77 53-13 12-64-39-61 39Z'),
      path('#e5c36e', 'm102 139 19-12 20 12v24h-39Zm475-7 18-11 19 11v23h-37Z'),
      stroke('#8a7454', 13, 'm187 220 258-36 171 24'),
      stroke('#c0a471', 4, 'm187 215 258-36 171 24M225 205v50M307 192v53M392 183v55M481 185v51M562 199v43'),
      stroke('#b5d3dc', 3, 'm0 233 89-17 89 18 93-18 93 18 96-17 96 17 94-17 140 19', .7),
    ],
  },
  highwatch_pass: {
    name: 'Highwatch Pass', caption: 'Frost-rimmed ramparts and signal cairns',
    description: 'Snow-striped mountain ramparts and a timber palisade guard the high pass beneath cold lightning.',
    paths: [
      path('#344b60', 'm0 177 129-132 91 105 103-89 99 101 123-119 107 118 148-98v197H0Z'),
      path('#b8cbd2', 'm71 105 58-60 45 52-29-12-17 21-18-24Zm208 15 44-59 46 47-24-9-19 17-18-17Zm309-19 57-58 50 55-28-11-20 19-21-19Z'),
      path('#1a2b3b', 'm84 260 17-94 73-28 64 22 19 100Zm405 0 18-91 67-31 75 28 23 94Z'),
      path('#425e70', 'm103 173 45-20 29 13 29-11 34 15-5 30H108Zm408-1 38-19 27 12 29-12 42 18-4 30H516Z'),
      stroke('#8b7455', 8, 'm277 260 8-102 24-20 20 19 21-26 22 25 22-19 22 22 20-19 22 22 10 98'),
      stroke('#d1dde0', 4, 'm90 167 82-32 68 24M494 169l81-34 78 31', .8),
    ],
  },
  sunscar_relay: {
    name: 'Sunscar Relay', caption: 'Copper pylons across the inland terraces',
    description: 'Copper-wound signal pylons rise from layered sandstone terraces beneath a pale storm sky.',
    paths: [
      path('#4a4650', 'm0 181 116-38 110 27 104-45 115 43 115-30 112 36 128-33v119H0Z'),
      path('#7c674f', 'm0 208 132-31 115 26 120-35 119 33 122-30 192 37v52H0Z'),
      path('#a58a5f', 'm0 235 139-26 118 23 124-29 127 28 124-25 168 29v25H0Z'),
      stroke('#b7874f', 12, 'M214 234 242 66M571 234 545 66'),
      stroke('#e0b46a', 4, 'm224 174 34-8m-28-37 34-8m-27-37 32-8M554 174l34 8m-40-45 34 8m-40-45 32 8'),
      path('#263746', 'm204 70 38-29 38 29-12 25h-51Zm303 0 38-29 38 29-12 25h-51Z'),
      path('#edcf79', 'm229 66 13-10 14 10-5 15h-18Zm303 0 13-10 14 10-5 15h-18Z'),
      stroke('#d6aa61', 5, 'm278 75 111 44 118-44M242 42V15M545 42V15', .8),
    ],
  },
  stormcrown_spire: {
    name: 'Stormcrown Spire', caption: 'Basalt steps beneath the perpetual squall',
    description: 'Lightning-split basalt stairs and ancient survey buttresses climb toward a jagged summit beacon.',
    paths: [
      path('#283d52', 'm0 260 73-124 68 30 82-101 65 65 93-114 83 105 78-73 83 111 75-37 100 138Z'),
      path('#142536', 'm152 260 38-79 61-20 31-61 59-19 37-76 45 72 55 23 32 62 65 22 43 76Z'),
      path('#3d5365', 'm278 260 20-49h57l12-44h52l14-48h45l23 48h48l14 44h54l22 49Z'),
      path('#172635', 'm355 260 15-105 34-24 19-72 22 69 34 27 17 105Z'),
      stroke('#94bdd2', 5, 'm432 7-35 55 28-8-39 64M162 27l-27 43 23-6-32 49', .85),
      stroke('#879aa7', 4, 'm302 211h52m15-44h49m14-48h45M355 155l-31-30m155 30 31-30', .65),
      path('#d4b566', 'm410 113 13-18 14 18-5 25h-18Z'),
    ],
  },
  storms_eye: {
    name: 'The Storm’s Eye', caption: 'The suspended causeway and living core',
    description: 'Two lightning anchors flank a suspended angular causeway around a radiant geometric storm core.',
    paths: [
      path('#1e3449', 'm0 213 120-46 103 32 96-41 95 39 100-42 99 43 87-28 100 38v52H0Z'),
      path('#0a1523', 'm0 236 132-30 112 26 113-31 112 32 116-30 215 35v22H0Z'),
      stroke('#718fa4', 18, 'm105 231 154-77 139 55 143-55 158 77'),
      stroke('#c0a867', 4, 'm105 226 154-77 139 55 143-55 158 77'),
      path('#263d50', 'm134 211 18-133 39-27 38 27 19 133Zm427 0 18-133 39-27 38 27 19 133Z'),
      path('#c39e53', 'm145 82 46-43 47 43-14 28h-65Zm427 0 46-43 47 43-14 28h-65Z'),
      path('#efd37b', 'm176 76 15-16 16 16-6 22h-20Zm427 0 15-16 16 16-6 22h-20Z'),
      path('#886d9e', 'm340 111 60-57 61 57-20 76h-82Z'),
      path('#d2b7e5', 'm365 116 35-35 36 35-12 50h-49Z'),
      path('#fff0b0', 'm388 119 12-14 13 14-5 29h-16Z'),
      stroke('#a8cee0', 4, 'm191 39 83 62m339-62-83 62M400 54V17M340 111l-48-38m169 38 48-38', .75),
    ],
  },
};

/**
 * Small original silhouettes and surface textures give every fixed vista its
 * own ecology. They are decorative only: no encounters, rewards, or state.
 */
const LIFE = {
  greyhaven: [
    stroke('#7893a2', 3, 'm151 93c-19-10 16-18-3-30m197 55c-15-9 13-16-2-26m293-1c-17-9 15-17-3-28', .35),
    stroke('#9ba9a8', 2, 'm548 101V75m-15 8h31l-9-7m-9 7 8 7', .7),
    path('#1a3039', 'm0 226 18-18 8 12 13-24 13 22 15-12 17 20Zm698 8 19-29 11 17 14-25 12 23 18-13 28 27Z'),
    stroke('#a4b6b8', 2, 'm221 151q7-8 14 0 7-8 14 0m-31 12q6-7 12 0 6-7 12 0', .65),
  ],
  ridge_road: [
    stroke('#728773', 3, 'm38 221-8-22m9 21 6-28m-3 29 17-19m36 7-5-21m7 20 10-26m-5 28 17-15', .65),
    path('#1a2b39', 'm616 218 101-18 45 15-122 19Z'),
    stroke('#76664b', 4, 'm632 208q29 18 63-3m-59-4q25 16 53-2m-48-3 39 12m-34-16 42 10', .9),
    path('#d8d2b4', 'M650 205c-8 0-11-7-9-14 2-8 5-12 9-12 5 0 8 6 10 13 2 8-3 13-10 13Zm17-2c-7 0-10-7-8-14 2-8 5-12 9-12s8 6 9 13c2 8-3 13-10 13Zm17 1c-7 0-10-6-8-13 2-8 5-12 9-12s8 5 9 12c2 8-2 13-10 13Z'),
    stroke('#8d8268', 2, 'm647 189 3 2m-2 7 3-1m14-9 3 2m-1 7 3-1m12-6 3 2m-4 6 3 1', .75),
    stroke('#8ba0aa', 2, 'm536 135 36-12m-27 25 48-14m-28 27 29-9', .35),
  ],
  observatory_ruins: [
    stroke('#587b67', 4, 'm103 221-9-31 14-17-8-21m9 38 18-12m-24-5-15-8m473 59 11-29-8-20 14-18m-17 37-17-11m23-8 16-12', .7),
    path('#6d8b70', 'm93 191-15-8 12-5Zm14-18 12-12 3 14Zm460 24-15-11 14-5Zm9-23 13-12 2 15Z'),
    stroke('#7b694d', 4, 'm586 217q27 15 57-2m-52-5q22 14 46-1m-43-3 37 12m-32-16 38 10', .85),
    path('#d5ceb0', 'M605 209c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm19 0c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Z'),
    stroke('#8a8069', 2, 'm601 194 4 2m-1 7 3-1m14-9 4 2m-2 8 3-1', .7),
    stroke('#b79b60', 3, 'm260 231 14-8 12 7 14-9m-31 5 4 13m10-14-2 12', .55),
  ],
  beacon_tower: [
    path('#9b5850', 'm444 128 45 12-42 17Zm-89 34-36 11 34 15Z', ' opacity=\".8\"'),
    stroke('#a9bcc2', 3, 'm130 84q11-12 22 0 11-12 22 0m43 31q9-10 18 0 9-10 18 0m341-52q10-11 20 0 10-11 20 0', .65),
    path('#203542', 'm110 238 123-29 68 19-153 25Z'),
    stroke('#77664a', 4, 'm147 219q31 17 65-3m-59-5q26 16 54-2m-48-3 42 13m-37-17 44 11', .85),
    path('#d8d0ae', 'M169 213c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm19-1c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Z'),
    stroke('#8b8067', 2, 'm165 198 4 2m-1 7 3-1m14-9 4 2m-2 8 3-1', .7),
    stroke('#778b96', 2, 'm38 177 72-20m-51 35 82-22m472-26 75-20m-57 37 89-25', .3),
  ],
  saltmere_coast: [
    stroke('#78906f', 3, 'm24 229-7-31m9 30 5-38m0 39 16-28m653 24-4-35m7 34 9-42m-4 43 18-32m-8 34 25-19', .7),
    stroke('#b5cdd2', 2, 'm292 99q10-11 20 0 10-11 20 0m42-28q8-9 16 0 8-9 16 0m280 52q9-10 18 0 9-10 18 0', .7),
    path('#243a40', 'm638 202 80-19 52 16-103 20Z'),
    stroke('#77674d', 4, 'm661 192q27 16 57-2m-52-5q23 14 47-1m-42-3 37 12m-32-16 38 10', .9),
    path('#ded5b5', 'M680 187c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm18 1c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm17-2c-7 0-10-6-8-13 2-8 5-11 9-11s7 5 8 12c2 7-2 12-9 12Z'),
    stroke('#91836a', 2, 'm676 172 4 2m-1 7 3-1m13-8 4 2m-2 7 3-1m12-9 3 2', .75),
    path('#c4b185', 'm92 244 9-7 8 6-8 5Zm41-9 8-6 7 5-7 5Zm453 16 9-7 8 6-8 5Z', ' opacity=\".55\"'),
  ],
  highwatch_pass: [
    stroke('#d9e4e4', 3, 'm23 76 61-19m-39 38 86-25m353-17 68-20m-42 39 89-26m71 57 65-18', .35),
    stroke('#94a7aa', 3, 'm69 238 9-3m18-9 9-3m19-9 9-3m531 23 9-3m18-9 9-3m18-9 9-3', .55),
    path('#263b47', 'm102 180 98-19 54 17-124 20Z'),
    stroke('#74664f', 4, 'm127 167q29 17 61-2m-55-5q24 15 50-1m-45-3 40 12m-34-16 41 10', .9),
    path('#d8d3ba', 'M148 162c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm18-1c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm18 2c-7 0-10-6-8-13 2-8 5-11 9-11s7 5 8 12c2 7-2 12-9 12Z'),
    stroke('#8c8471', 2, 'm144 147 4 2m-1 7 3-1m13-9 4 2m-2 8 3-1m13-7 3 2', .7),
    stroke('#7f969d', 3, 'm300 246 8-25m3 24 14-31m-4 33 19-23m63 19-4-27m9 26 9-34', .55),
  ],
  sunscar_relay: [
    stroke('#c09a62', 3, 'm48 245-4-27m8 25 9-34m-3 36 17-24m42 20-3-24m8 23 10-30m465 32-5-28m10 26 8-35m-2 37 18-25', .7),
    stroke('#e1bd76', 2, 'm300 76 8-8m-4 17 13-2m150-5-8-8m4 17-13-2', .65),
    path('#735e45', 'm74 232 92-20 59 18-120 22Z'),
    stroke('#675541', 4, 'm102 220q29 17 61-2m-55-5q24 15 50-1m-45-3 40 12m-34-16 41 10', .9),
    path('#ddd0a9', 'M123 215c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm18-1c-8 0-11-7-9-14 2-8 5-12 9-12s8 6 10 13c1 8-3 13-10 13Zm18 2c-7 0-10-6-8-13 2-8 5-11 9-11s7 5 8 12c2 7-2 12-9 12Z'),
    stroke('#958064', 2, 'm119 200 4 2m-1 7 3-1m13-9 4 2m-2 8 3-1m13-7 3 2', .75),
    path('#5f5142', 'm671 238 18-8 15 5-11 7Zm28-18 14-6 12 5-10 6Z'),
  ],
  stormcrown_spire: [
    stroke('#8ba5b2', 3, 'm56 174 46-16m-26 34 64-21m515-23 61-19m-39 39 74-23', .3),
    path('#6e8d7d', 'm229 235 9-18 8 12 11-22 10 28Zm322-12 9-17 8 11 10-20 11 26Z', ' opacity=\".65\"'),
    stroke('#a6c3ca', 2, 'm201 105q9-10 18 0 9-10 18 0m-48-26q7-8 14 0 7-8 14 0', .5),
    path('#293e4d', 'm92 239 25-17 21 12 28-20 25 25Zm552-6 24-17 20 12 25-19 28 24Z'),
    stroke('#d0b56f', 2, 'm415 131 7 8-6 11m8-19 8 6', .6),
  ],
  storms_eye: [
    stroke('#b9a5cf', 3, 'm76 119 18-8m-9 23 26-11m554-16 21-9m-10 25 30-12', .45),
    path('#88769e', 'm278 91 9-17 8 15-7 13Zm229 22 10-18 8 16-8 14Zm-213 96 8-14 7 12-6 11Z', ' opacity=\".7\"'),
    stroke('#e1cd8b', 2, 'm314 47 5-12m-1 18 13-5m151 22 6-13m-2 19 13-5M99 197l12-5m580 7 13-6', .65),
    path('#263b4c', 'm54 245 24-15 20 11 25-17 27 21Zm633 1 22-16 20 12 24-18 29 22Z'),
  ],
};

const FALLBACK = {
  name: 'Frontier', caption: 'An uncharted road beneath the storm',
  description: 'An angular frontier ridge and a narrow trail beneath a dark storm sky.',
  paths: [path('#30485b', 'm0 215 150-91 120 71 135-107 124 99 121-63 150 85v51H0Z'), stroke('#c0b88f', 8, 'm260 260 105-62-55-40 122-67')],
};

/** Original path-only scenic art. Unknown zones receive a non-spoiler frontier vista. */
export function zoneArt(zone = 'greyhaven') {
  const requested = typeof zone === 'string' ? zone : zone?.id;
  const known = typeof requested === 'string' && Object.hasOwn(VISTAS, requested);
  const id = known ? requested : 'frontier';
  const vista = known ? VISTAS[requested] : FALLBACK;
  const titleId = `zone-vista-${id}-title`;
  const descId = `zone-vista-${id}-desc`;
  return `<svg class="zone-vista__art" data-zone="${id}" viewBox="0 0 800 260" role="img" focusable="false" aria-labelledby="${titleId} ${descId}">
    <title id="${titleId}">${escapeHTML(vista.name)} expedition vista</title>
    <desc id="${descId}">${escapeHTML(vista.description)}</desc>
    <g aria-hidden="true">${SKY.join('')}${vista.paths.join('')}${known && LIFE[requested] ? `<g class="zone-vista__life zone-vista__life--${id}" aria-hidden="true">${LIFE[requested].join('')}</g>` : ''}</g>
  </svg>`;
}

export function zoneVista(zone = 'greyhaven') {
  const requested = typeof zone === 'string' ? zone : zone?.id;
  const vista = typeof requested === 'string' && Object.hasOwn(VISTAS, requested) ? VISTAS[requested] : FALLBACK;
  return `<figure class="zone-vista">${zoneArt(zone)}<figcaption><span>Field vista</span><strong>${escapeHTML(vista.caption)}</strong></figcaption></figure>`;
}
