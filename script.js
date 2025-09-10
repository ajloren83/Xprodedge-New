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
  const totalFrames = 1075;
  const maxCacheSize = 1075;
  const preloadBuffer = 30;
  let currentFrame = 1;
  
  let lastScrollProgress = 0;
  let lastTime = performance.now();
  const frameCache = new Map();
  let lastRenderedFrame = null;
  let framesLoaded = 0;
  
  const framePaths = Array.from({ length: totalFrames }, (_, i) =>
    `assets/frames/frame-${String(i + 1).padStart(4, "0")}.webp`
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
      // Auto-scroll 25 frames after loading
      autoScrollFrames(25);
    }, 500);
  }
  
  // Auto-scroll function to scroll a specific number of frames
  function autoScrollFrames(frameCount) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const frameHeight = scrollHeight / (totalFrames - 1);
    const targetScrollY = currentScrollY + (frameCount * frameHeight);
    
    // Ensure we don't scroll beyond the maximum scroll height
    const maxScrollY = Math.min(targetScrollY, scrollHeight);
    
    // Use Lenis smooth scroll if available, otherwise use native smooth scroll
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(maxScrollY, { 
        duration: 2.0, 
        easing: (t) => t * (2 - t) // ease-out
      });
    } else {
      window.scrollTo({ 
        top: maxScrollY, 
        behavior: 'smooth' 
      });
    }
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
        
        // Smooth scroll using Lenis with distance-based duration (slower)
        const currentY = window.scrollY || window.pageYOffset;
        const distance = Math.abs(currentY - targetScrollY);
        // Map distance to a slower duration range (2.0s to 4.0s)
        const duration = Math.min(4.0, Math.max(2.0, distance / 1500));
        const easeInOut = (t) => (t < 0.5) ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
        if (window.lenis && typeof window.lenis.scrollTo === 'function') {
          window.lenis.scrollTo(targetScrollY, { duration, easing: easeInOut });
        } else {
          window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
        }
        
        // Visual feedback on active tab
        frameTabs.forEach(t => t.style.opacity = '0.7');
        tab.style.opacity = '1';
        tab.style.transform = 'scale(1.05)';
        setTimeout(() => tab.style.transform = 'scale(1)', 200);
      });
    });
    
    // Header: scroll progress
    const progressFillEl = document.getElementById('scrollProgressFill');
    function updateScrollProgress(progress01) {
      if (progressFillEl) {
        progressFillEl.style.width = Math.round(progress01 * 100) + '%';
      }
    }

    // Header: menu toggle logic
    const menuToggleBtn = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    const menuIcon = document.getElementById('menuIcon');
    let isMenuOpen = false;
    const menuOverlay = document.getElementById('menuOverlay');
    const menuCloseBtn = document.getElementById('menuClose');

    function setMenuState(open) {
      isMenuOpen = open;
      if (!menuPanel || !menuToggleBtn || !menuIcon) return;

      // Toggle classes
      menuPanel.classList.toggle('open', open);
      if (menuOverlay) menuOverlay.classList.toggle('open', open);

      // Accessibility + icon
      menuToggleBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menuPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      menuOverlay?.setAttribute?.('aria-hidden', open ? 'false' : 'true');
      menuIcon.textContent = open ? '✕' : '▦';

      // GSAP animations
      if (window.gsap) {
        const items = menuPanel.querySelectorAll('.menu-item');
        if (open) {
          gsap.fromTo(menuToggleBtn, { scale: 1 }, { scale: 1.15, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 });
          gsap.fromTo(menuPanel, { y: 6, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
          if (items && items.length) {
            gsap.fromTo(items, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out', stagger: 0.06, delay: 0.06 });
          }
        } else {
          gsap.to(menuPanel, { y: 6, opacity: 0, scale: 0.98, duration: 0.22, ease: 'power2.in', onComplete: () => {
            menuPanel.classList.remove('open');
            if (menuOverlay) menuOverlay.classList.remove('open');
          } });
          if (items && items.length) {
            gsap.to(items, { y: 8, opacity: 0, duration: 0.16, ease: 'power2.in' });
          }
        }
      }
    }
    if (menuToggleBtn) {
      menuToggleBtn.addEventListener('click', () => setMenuState(!isMenuOpen));
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMenuOpen) setMenuState(false);
    });

    if (menuCloseBtn) menuCloseBtn.addEventListener('click', () => setMenuState(false));
    if (menuOverlay) menuOverlay.addEventListener('click', () => setMenuState(false));

    // Lenis smooth scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => t,
      smoothWheel: true,
      smoothTouch: false,
    });
    
    // Expose Lenis for navigation clicks
    window.lenis = lenis;

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
          updateScrollProgress(scrollProgress);
          
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
    
    let visibleSectionIndex = -1;
    
    frameBasedElements.forEach((section, idx) => {
      const revealFrame = parseInt(section.dataset.revealFrame);
      const frameDuration = parseInt(section.dataset.revealFrameDuration) || 173;
      const isVisible = frameIndex >= revealFrame && frameIndex < revealFrame + frameDuration;
      
      if (isVisible) {
        visibleSectionIndex = idx;
      }
      
      if (isVisible && section.classList.contains('content-hidden')) {
        section.classList.remove('content-hidden');
        section.classList.add('content-visible');
        
        // Force immediate visibility
        section.style.opacity = '1';
        section.style.visibility = 'visible';
        section.style.transform = 'translateY(0) scale(1)';
        
        gsap.fromTo(section, { opacity: 0, y: 50, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power2.out" });
      } else if (!isVisible && section.classList.contains('content-visible')) {
        section.classList.remove('content-visible');
        section.classList.add('content-hidden');
        
        // Force immediate hiding
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.style.transform = 'translateY(50px) scale(0.9)';
        
        gsap.to(section, { opacity: 0, y: -30, scale: 0.95, duration: 0.5, ease: "power2.in" });
      }
    });
    
    // Update active tab to match visible section (or nearest frame)
    const frameTabs = document.querySelectorAll('.frame-tab');
    if (frameTabs.length) {
      let activeIdx = visibleSectionIndex;
      if (activeIdx === -1) {
        // Fallback: choose tab based on frame thresholds from data-frame
        const tabStarts = Array.from(frameTabs).map(t => parseInt(t.dataset.frame));
        for (let i = 0; i < tabStarts.length; i++) {
          const start = tabStarts[i];
          const next = tabStarts[i + 1] ?? Number.POSITIVE_INFINITY;
          if (frameIndex >= start && frameIndex < next) { activeIdx = i; break; }
        }
        if (activeIdx === -1) activeIdx = 0;
      }
      frameTabs.forEach((t, i) => {
        if (i === activeIdx) {
          t.classList.add('active');
          t.style.opacity = '1';
        } else {
          t.classList.remove('active');
          t.style.opacity = '0.7';
        }
      });
    }
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


});