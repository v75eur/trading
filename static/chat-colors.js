const COLOR_PALETTE = [
    '#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF9F1C',
    '#2EC4B6', '#E71D36', '#F9DC5C', '#011627', '#FDFFFC',
    '#B7094C', '#00916E', '#FFBC42', '#5D576B', '#F4D03F',
    '#E67E22', '#2ECC71', '#E74C3C', '#3498DB', '#9B59B6',
    '#1ABC9C', '#F39C12', '#D35400', '#C0392B', '#16A085'
];

function getColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash |= 0;
    }
    return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}
