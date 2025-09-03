# Xprodedge - Scroll Trigger Demo

A sophisticated scroll-triggered video frame player with precise frame-based content revelation capabilities.

## Features

- **Frame-perfect video playback**: 1362 frames synchronized with scroll position
- **Multiple timing systems**: Frame-based, time-based, and duration-based content reveals
- **Smooth animations**: GSAP-powered transitions with glass morphism effects
- **Responsive design**: Optimized for all device sizes
- **Web Worker support**: Efficient frame loading and caching

## Frame-Based Content Revelation

This demo showcases how to reveal specific elements at exact video frames, creating perfectly synchronized content experiences.

### Timing Systems

#### 1. **Frame-Based Timing** (Most Precise)
Use `data-reveal-frame` to specify exact frame numbers:

```html
<!-- Appears at exactly frame 500 -->
<section class="content-hidden" data-reveal-frame="500" data-reveal-frame-duration="60">
    <div class="glass">
        <h3>Frame 500 Content</h3>
        <p>This appears at exactly frame 500 and stays visible for 60 frames</p>
    </div>
</section>
```

#### 2. **Time-Based Timing** (Seconds-based)
Use `data-reveal-time` to specify time in seconds:

```html
<!-- Appears at 15 seconds into the video -->
<section class="content-hidden" data-reveal-time="15" data-reveal-duration="8">
    <div class="glass">
        <h3>15 Second Mark</h3>
        <p>This appears at 15 seconds and stays visible for 8 seconds</p>
    </div>
</section>
```

#### 3. **Duration Control**
- `data-reveal-frame-duration`: How many frames to show (for frame-based)
- `data-reveal-duration`: How many seconds to show (for time-based)

### JavaScript API

#### Dynamic Content Addition

```javascript
// Add content at specific frame
addContentAtFrame(`
    <section class="dynamic-section">
        <div class="glass glass-dark">
            <h3>Dynamic Content!</h3>
            <p>Added programmatically at frame 750</p>
        </div>
    </section>
`, 750, 45); // Frame 750, visible for 45 frames

// Add content at specific time
addContentAtTime(`
    <section class="timing-section">
        <div class="glass">
            <h3>Timed Content!</h3>
            <p>Added at 25 seconds</p>
        </div>
    </section>
`, 25, 10); // 25 seconds, visible for 10 seconds
```

#### Frame Information

```javascript
// Get current frame information
const frameInfo = getCurrentFrameInfo();
console.log(`Frame: ${frameInfo.frame}, Time: ${frameInfo.timeInSeconds}s, Progress: ${frameInfo.progress}%`);
```

### CSS Classes

- `content-hidden`: Hidden state (opacity: 0, visibility: hidden)
- `content-visible`: Visible state (opacity: 1, visibility: visible)
- `glass`: Glass morphism effect
- `glass-dark`: Darker glass variant

### Example Use Cases

1. **Product Reveals**: Show product information at specific video moments
2. **Call-to-Actions**: Display CTAs at optimal engagement points
3. **Information Overlays**: Reveal details synchronized with video content
4. **Interactive Elements**: Show interactive components at precise frames
5. **Storytelling**: Build narrative through timed content reveals

### Performance Tips

- Use frame-based timing for precise control
- Limit simultaneous visible elements
- Use appropriate duration values to avoid cluttering
- Test on target devices for smooth performance

## Setup

1. Ensure all video frames are in `assets/6X Invincix/frames/`
2. Update `totalFrames` in `script.js` if frame count changes
3. Adjust video duration assumption (currently 45 seconds) if needed
4. Customize timing values for your content

## Browser Support

- Modern browsers with ES6+ support
- Web Workers for frame loading
- Canvas API for frame rendering
- CSS backdrop-filter for glass effects

## Dependencies

- GSAP (GreenSock Animation Platform)
- ScrollTrigger plugin
- Lenis smooth scrolling
- Custom Web Worker for frame management
