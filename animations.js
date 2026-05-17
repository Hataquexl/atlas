
gsap.to(".loader-progress",{
  width:"100%",
  duration:2,
  ease:"power2.out",

  onComplete:()=>{

    gsap.to("#loading-screen",{
      opacity:0,
      duration:1,

      onComplete:()=>{
        document.querySelector("#loading-screen").remove();
      }
    });

  }
});

window.addEventListener("mousemove",(e)=>{

  gsap.to(".cursor",{
    x:e.clientX,
    y:e.clientY,
    duration:.15
  });

});
