document.addEventListener("DOMContentLoaded", () => {
  // Preloader elements
  const preloader = document.getElementById('preloader');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const loadingInfo = document.getElementById('loadingInfo');
  
  const canvas = document.getElementById("scrollCanvas");
  const context = canvas.getContext("2d");
  
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  // CONFIGURATION
  const totalFrames = 655;
  const maxCacheSize = 655;
  const preloadBuffer = 30;
  let currentFrame = 1;
  
  let lastScrollProgress = 0;
  let lastTime = performance.now();
  const frameCache = new Map();
  let lastRenderedFrame = null;
  let framesLoaded = 0;
  
  const framePaths = Array.from({ length: totalFrames }, (_, i) =>
    `assets/xprodedge-video/frames/frame-${String(i + 1).padStart(4, "0")}.webp`
  );
  
  const worker = new Worker("frameWorker.js");
  
  // Update progress bar
  function updateProgress(loaded, total) {
    const percentage = Math.round((loaded / total) * 100);
    progressFill.style.width = percentage + '%';
    progressText.textContent = percentage + '%';
    loadingInfo.textContent = `Loaded ${loaded} of ${total} frames...`;
  }
  
  // Hide preloader and show main content
  function hidePreloader() {
    preloader.classList.add('hidden');
    setTimeout(() => {
      initializeMainSystem();
    }, 500);
  }
  
  // Initialize main system after all frames are loaded
  function initializeMainSystem() {
    // Set scroll spacer height
    const scrollSpacer = document.querySelector('.scroll-spacer');
    if (scrollSpacer) {
      const frameHeight = Math.max(window.innerHeight, 800);
      const totalScrollHeight = totalFrames * (frameHeight / 30);
      scrollSpacer.style.height = `${totalScrollHeight}px`;
    }
    
    // Determine actual frame based on current scroll position
    const scrollProgress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    currentFrame = Math.floor(scrollProgress * (totalFrames - 1)) + 1;
    renderFrame(currentFrame);
    updateContentVisibility(currentFrame);
    
    // Frame navigation
    const frameTabs = document.querySelectorAll('.frame-tab');
    frameTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetFrame = parseInt(tab.dataset.frame);
        const scrollProgress = (targetFrame - 1) / (totalFrames - 1);
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const targetScrollY = scrollProgress * scrollHeight;
        
        window.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });
        
        currentFrame = targetFrame;
        renderFrame(currentFrame);
        setTimeout(() => updateContentVisibility(currentFrame), 300);
        
        frameTabs.forEach(t => t.style.opacity = '0.7');
        tab.style.opacity = '1';
        tab.style.transform = 'scale(1.05)';
        setTimeout(() => tab.style.transform = 'scale(1)', 200);
      });
    });
    
    // Lenis smooth scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => t,
      smoothWheel: true,
      smoothTouch: false,
    });
    
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    // GSAP ScrollTrigger with proper frame calculation
    gsap.registerPlugin(ScrollTrigger);
    
    // Create a timeline that directly controls frame progression
    const mainTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onUpdate: (self) => {
          const scrollProgress = self.progress;
          
          // Calculate frame based on scroll progress (0 to 1)
          let frameIndex = Math.round(scrollProgress * (totalFrames - 1)) + 1;
          frameIndex = Math.min(totalFrames, Math.max(1, frameIndex));
          
          // Only update if frame actually changed
          if (frameIndex !== currentFrame) {
            currentFrame = frameIndex;
            renderFrame(currentFrame);
            updateContentVisibility(currentFrame);
          }
        }
      }
    });
    
    // Add frame progression to timeline
    mainTimeline.to({}, { 
      duration: 1,
      onUpdate: function() {
        // This ensures the timeline is properly initialized
      }
    });
    
    // Canvas resize
    function resizeCanvas() {
      const container = document.querySelector('.container');
      if (container && canvas) {
        const rect = container.getBoundingClientRect();
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
      }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
  
  worker.addEventListener("message", async (e) => {
    if (e.data.type === "blobsLoaded") {
      for (const { blob, framePath } of e.data.payload) {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((res) => (img.onload = res));
        const index = framePaths.indexOf(framePath) + 1;
        frameCache.set(index, img);
        
        framesLoaded++;
        updateProgress(framesLoaded, totalFrames);
        
        if (framesLoaded === totalFrames) {
          hidePreloader();
        }
      }
    } else if (e.data.type === "error") {
      console.error("Frame loading error:", e.data.payload.error);
    }
  });
  
  function preloadFrames(index) {
    const start = Math.max(1, index - preloadBuffer);
    const end = Math.min(totalFrames, index + preloadBuffer);
    const priorityFrames = [];
    const regularFrames = [];
    
    for (let i = start; i <= end; i++) {
      if (!frameCache.has(i)) {
        if (i === index) {
          priorityFrames.push(framePaths[i - 1]);
        } else {
          regularFrames.push(framePaths[i - 1]);
        }
      }
    }
    
    if (priorityFrames.length > 0) {
      worker.postMessage({ type: "loadFrames", payload: { frames: priorityFrames } });
    }
    if (regularFrames.length > 0) {
      worker.postMessage({ type: "loadFrames", payload: { frames: regularFrames } });
    }
  }
  
  function renderFrame(index) {
    const img = frameCache.get(index);
    
    if (!img) {
      let closestFrame = null;
      let minDistance = Infinity;
      for (let i = 1; i <= totalFrames; i++) {
        if (frameCache.has(i)) {
          const distance = Math.abs(i - index);
          if (distance < minDistance) {
            minDistance = distance;
            closestFrame = i;
          }
        }
      }
      if (closestFrame && closestFrame !== lastRenderedFrame) {
        drawFrameToCanvas(frameCache.get(closestFrame));
        lastRenderedFrame = closestFrame;
      }
      return;
    }
    
    drawFrameToCanvas(img);
    lastRenderedFrame = index;
    preloadFrames(index);
  }
  
  function drawFrameToCanvas(img) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    canvas.width = viewportWidth;
    canvas.height = viewportHeight;
    
    const imgAspectRatio = img.width / img.height;
    const viewportAspectRatio = viewportWidth / viewportHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    if (imgAspectRatio > viewportAspectRatio) {
      drawHeight = viewportHeight;
      drawWidth = viewportHeight * imgAspectRatio;
      offsetX = (viewportWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = viewportWidth;
      drawHeight = viewportWidth / imgAspectRatio;
      offsetX = 0;
      offsetY = (viewportHeight - drawHeight) / 2;
    }
    
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }
  
  function updateContentVisibility(frameIndex) {
    const frameBasedElements = document.querySelectorAll('[data-reveal-frame]');
    
    console.log(`Current Frame: ${frameIndex}`);
    
    frameBasedElements.forEach((section) => {
      const revealFrame = parseInt(section.dataset.revealFrame);
      const frameDuration = parseInt(section.dataset.revealFrameDuration) || 131;
      const isVisible = frameIndex >= revealFrame && frameIndex < revealFrame + frameDuration;
      
      console.log(`Section ${section.querySelector('h2').textContent}: Frame ${revealFrame}-${revealFrame + frameDuration}, Visible: ${isVisible}`);
      
      if (isVisible && section.classList.contains('content-hidden')) {
        console.log(`Making section visible: ${section.querySelector('h2').textContent}`);
        section.classList.remove('content-hidden');
        section.classList.add('content-visible');
        
        // Force immediate visibility
        section.style.opacity = '1';
        section.style.visibility = 'visible';
        section.style.transform = 'translateY(0) scale(1)';
        
        gsap.fromTo(section, { opacity: 0, y: 50, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power2.out" });
      } else if (!isVisible && section.classList.contains('content-visible')) {
        console.log(`Hiding section: ${section.querySelector('h2').textContent}`);
        section.classList.remove('content-visible');
        section.classList.add('content-hidden');
        
        // Force immediate hiding
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.style.transform = 'translateY(50px) scale(0.9)';
        
        gsap.to(section, { opacity: 0, y: -30, scale: 0.95, duration: 0.3, ease: "power2.in" });
      }
    });
  }
  
  updateProgress(0, totalFrames);
  
  const batchSize = 50;
  for (let i = 0; i < totalFrames; i += batchSize) {
    const batch = framePaths.slice(i, i + batchSize);
    setTimeout(() => {
      worker.postMessage({ type: "loadFrames", payload: { frames: batch } });
    }, i * 10);
  }
  
  function cleanup() {
    frameCache.forEach(img => {
      if (img.src) {
        URL.revokeObjectURL(img.src);
      }
    });
    worker.terminate();
    frameCache.clear();
  }
  
  window.addEventListener('beforeunload', cleanup);
  
  worker.addEventListener('error', (error) => {
    console.error('Web Worker error:', error);
  });

  // Test function to manually show/hide sections
  window.testSection = function(sectionNumber) {
    const sections = document.querySelectorAll('.content-section');
    if (sectionNumber >= 1 && sectionNumber <= sections.length) {
      const section = sections[sectionNumber - 1];
      console.log(`Testing Section ${sectionNumber}: ${section.querySelector('h2').textContent}`);
      
      // Hide all sections first
      sections.forEach(s => {
        s.classList.remove('content-visible');
        s.classList.add('content-hidden');
        s.style.opacity = '0';
        s.style.visibility = 'hidden';
        s.style.transform = 'translateY(50px) scale(0.9)';
      });
      
      // Show the selected section
      section.classList.remove('content-hidden');
      section.classList.add('content-visible');
      section.style.opacity = '1';
      section.style.visibility = 'visible';
      section.style.transform = 'translateY(0) scale(1)';
      
      console.log(`Section ${sectionNumber} should now be visible`);
    }
  };
  
  // Test function to show all sections
  window.showAllSections = function() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
      section.classList.remove('content-hidden');
      section.classList.add('content-visible');
      section.style.opacity = '1';
      section.style.visibility = 'visible';
      section.style.transform = 'translateY(0) scale(1)';
    });
    console.log('All sections are now visible');
  };
  
  // Test function to hide all sections
  window.hideAllSections = function() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
      section.classList.remove('content-visible');
      section.classList.add('content-hidden');
      section.style.opacity = '0';
      section.style.visibility = 'hidden';
      section.style.transform = 'translateY(50px) scale(0.9)';
    });
    console.log('All sections are now hidden');
  };
});

