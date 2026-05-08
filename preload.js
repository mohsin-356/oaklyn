import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('burgerPos', {
  getMachineId: () => ipcRenderer.invoke('license:machineId'),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  printSilent: (htmlContent) => ipcRenderer.invoke('print:silent', htmlContent),
  printSilentToPrinter: (htmlContent, printerName) => ipcRenderer.invoke('print:silentToPrinter', htmlContent, printerName),
  getPrinterList: () => ipcRenderer.invoke('printer:getList'),
})
