const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');
const { createCanvas } = require('canvas');

async function generateIcon() {
  try {
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#FF6B35');
      gradient.addColorStop(1, '#F7931E');

      // Rounded rectangle
      const r = size * 0.15;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0);
      ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r);
      ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size);
      ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // White "O" letter
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${size * 0.55}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('O', size / 2, size / 2 + size * 0.02);

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.stroke();

      // Get PNG buffer
      const pngBuffer = canvas.toBuffer('image/png');
      pngBuffers.push(pngBuffer);
      
      console.log(`Generated ${size}x${size} icon size`);
    }

    // Convert to ICO
    console.log('Converting to ICO format...');
    const icoBuffer = await toIco(pngBuffers);

    // Save ICO file
    const outputPath = path.join(__dirname, '..', 'assets', 'icon.ico');
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`\n✅ Icon created successfully at: ${outputPath}`);
    console.log(`   File size: ${(icoBuffer.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Error creating icon:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateIcon();
