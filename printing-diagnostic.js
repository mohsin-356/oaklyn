// Printing Diagnostic Script
console.log('=== Oaklyn POS Printing Diagnostic ===');

// Check if we're in the right environment
console.log('\n--- Environment Check ---');
const isElectron = typeof process !== 'undefined' && 
                  process.versions && 
                  process.versions.electron;

console.log('Running in Electron:', isElectron ? '✓ Yes' : '✗ No');

// Check if burgerPos API is available
console.log('\n--- API Availability Check ---');
if (typeof window !== 'undefined' && window.burgerPos) {
  console.log('✓ burgerPos API is available');
  
  // Check individual functions
  const functions = [
    'printSilent',
    'printSilentToPrinter', 
    'getPrinterList'
  ];
  
  functions.forEach(func => {
    if (typeof window.burgerPos[func] === 'function') {
      console.log(`✓ ${func} function is available`);
    } else {
      console.log(`✗ ${func} function is missing`);
    }
  });
} else {
  console.log('✗ burgerPos API is not available');
  console.log('This diagnostic must be run in the Oaklyn POS application');
}

// Check printer configuration
console.log('\n--- Printer Configuration Check ---');
try {
  // This would normally be imported, but we can check localStorage directly
  const printerConfig = localStorage.getItem('printerConfig');
  if (printerConfig) {
    const config = JSON.parse(printerConfig);
    console.log('Printer configuration found:', config);
    if (config.printerName) {
      console.log(`✓ Configured printer: ${config.printerName}`);
    } else {
      console.log('⚠ No printer selected in configuration');
    }
  } else {
    console.log('⚠ No printer configuration found');
  }
} catch (error) {
  console.log('✗ Error reading printer configuration:', error.message);
}

// Test getting printer list
console.log('\n--- Printer List Test ---');
if (window.burgerPos && window.burgerPos.getPrinterList) {
  window.burgerPos.getPrinterList()
    .then(result => {
      if (result && result.success) {
        console.log(`✓ Successfully retrieved ${result.printers.length} printers`);
        
        if (result.printers.length > 0) {
          console.log('\nAvailable printers:');
          result.printers.forEach((printer, index) => {
            console.log(`  ${index + 1}. ${printer.displayName || printer.name} ${printer.isDefault ? '(Default)' : ''}`);
          });
        } else {
          console.log('⚠ No printers found - please connect a printer');
        }
      } else {
        console.log('✗ Failed to retrieve printer list:', result ? result.error : 'Unknown error');
      }
    })
    .catch(error => {
      console.log('✗ Error getting printer list:', error.message);
    });
} else {
  console.log('✗ getPrinterList function not available');
}

// Create a simple test receipt
console.log('\n--- Test Receipt Creation ---');
const testReceipt = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Test Receipt</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      width: 80mm; 
      margin: 0; 
      padding: 10px; 
      font-size: 12px;
    }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; margin: 5px 0; }
  </style>
</head>
<body>
  <div class="center"><h3>Oaklyn Test</h3></div>
  <div class="center">Printing Diagnostic</div>
  <div class="center">${new Date().toLocaleString()}</div>
  <hr>
  <div class="row"><div>Diagnostic Test</div><div>Passed</div></div>
  <div class="row"><div>Status</div><div>Operational</div></div>
  <div class="center" style="margin-top:10px">Diagnostic Complete!</div>
</body>
</html>`;

console.log('✓ Test receipt created successfully');

console.log('\n=== Diagnostic Complete ===');
console.log('\nTo test actual printing:');
console.log('1. Go to Settings → Printer Settings');
console.log('2. Enable Custom Printer');
console.log('3. Select your printer');
console.log('4. Save settings');
console.log('5. Go to any POS category');
console.log('6. Add items to cart');
console.log('7. Click "Print Invoice"');