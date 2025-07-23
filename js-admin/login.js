function scaleToFitScreen() {
      const designWidth = 1920;
      const designHeight = 1080;
      const scaleX = window.innerWidth / designWidth;
      const scaleY = window.innerHeight / designHeight;
      const scale = Math.min(scaleX, scaleY);

      const wrapper = document.querySelector('.scale-wrapper');
      wrapper.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', scaleToFitScreen);
    window.addEventListener('load', scaleToFitScreen);