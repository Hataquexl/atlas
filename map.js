
const map = document.querySelector("#world-map");

const panzoom = Panzoom(map, {
  maxScale: 8,
  minScale: 1,
  contain: "outside"
});

map.parentElement.addEventListener("wheel", panzoom.zoomWithWheel);

const marker = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "circle"
);

marker.setAttribute("cx", 400);
marker.setAttribute("cy", 220);
marker.setAttribute("r", 6);

marker.style.fill = "#4ade80";

map.appendChild(marker);

gsap.to(marker,{
  scale:1.4,
  repeat:-1,
  yoyo:true,
  duration:1.2
});
