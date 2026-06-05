const COLORS = [
    '#FF6B6B','#4ECDC4','#FFE66D','#1A535C','#FF9F1C','#2EC4B6','#E71D36',
    '#F9DC5C','#011627','#FDFFFC','#B7094C','#00916E','#FFBC42','#5D576B',
    '#F4D03F','#E67E22','#2ECC71','#E74C3C','#3498DB','#9B59B6','#1ABC9C',
    '#F39C12','#D35400','#C0392B','#16A085','#F8C471','#5D6D7E','#A569BD',
    '#48C9B0','#F1948A','#85C1E9','#F9E79F','#EB984E','#7DCEA0','#D98880'
];

function getColor(u) {
    let h=0;
    for(let i=0;i<u.length;i++) h=((h<<5)-h)+u.charCodeAt(i),h|=0;
    return COLORS[Math.abs(h)%COLORS.length];
}
