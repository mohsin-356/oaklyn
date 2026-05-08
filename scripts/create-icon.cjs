const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

// Create a simple 256x256 PNG with a simple design for Oaklyn
// We'll use canvas to draw a simple icon
const { createCanvas } = require('canvas');

async function generateIcon() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = [];

  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background - rounded rectangle with gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#FF6B35');  // Orange
    gradient.addColorStop(1, '#F7931E');    // Darker orange

    // Rounded rect background
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

    // Add shadow effect
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = size * 0.1;
    ctx.shadowOffsetY = size * 0.05;

    // "O" letter in center
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.6}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('O', size / 2, size / 2 + size * 0.05);

    // Add subtle border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();

    // Convert to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');
    pngs.push(pngBuffer);
  }

  // Convert all PNGs to ICO
  const icoBuffer = await pngToIco(pngs);
  
  // Save the ICO file
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoBuffer);
  console.log('Icon created successfully at assets/icon.ico');
}

generateIcon().catch(err => {
  console.error('Error creating icon:', err);
  process.exit(1);
});
