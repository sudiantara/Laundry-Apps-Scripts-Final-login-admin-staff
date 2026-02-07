function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LAUNDRY PRO DASHBOARD')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// GANTI ID DI BAWAH INI SESUAI DRIVE ANDA
const MASTER_FOLDER_ID = "1Sx7BEcpFKU6tRosxqKvM9zu8h7-dQiN0"; 
const REPORT_FOLDER_ID = "1aaN7y5enNjvnyq1125KWOf1c_OGfZphH"; 
const TEMPLATE_DOC_ID = "1ET7k3TLNxUj8Mx7oTGN1NPhAVCPKUGb3Z6fc7IYQIPc";
const PIN_ADMIN = "1234";
const PIN_STAFF = "5678";

function checkLogin(pin) {
  if (pin === PIN_ADMIN) return { role: "ADMIN", name: "Administrator" };
  if (pin === PIN_STAFF) return { role: "STAFF", name: "Staff Laundry" };
  return null;
}

function getLaundryData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); 
  return data.map(r => [
    r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+8", "yyyy-MM-dd") : "", 
    r[1], r[2], r[3], r[4], 
    r[5] ? r[5].toString() : "0", 
    r[6], r[7], r[8], 
    r[9] instanceof Date ? Utilities.formatDate(r[9], "GMT+8", "dd/MM/yyyy, HH:mm") : r[9], 
    r[10] || "Belum Bayar", 
    r[11] instanceof Date ? Utilities.formatDate(r[11], "GMT+8", "yyyy-MM-dd") : "", 
    r[12] || "", 
    r[13] || ""  
  ]);
}

function getFinancialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Pengeluaran");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    tanggal: r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+8", "dd/MM/yyyy") : "",
    kategori: r[1],
    keterangan: r[2],
    jumlah: Number(r[3]),
    user: r[4]
  }));
}

function generateDocReport(from, to, omzet, biaya, laba) {
  const reportFolder = DriveApp.getFolderById(REPORT_FOLDER_ID);
  const template = DriveApp.getFileById(TEMPLATE_DOC_ID);
  const newFile = template.makeCopy("REKAP_" + from + "_TO_" + to, reportFolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();
  
  body.replaceText("{{from}}", from);
  body.replaceText("{{to}}", to);
  body.replaceText("{{omzet}}", omzet);
  body.replaceText("{{biaya}}", biaya);
  body.replaceText("{{laba}}", laba);
  body.replaceText("{{tanggal}}", Utilities.formatDate(new Date(), "GMT+8", "dd/MM/yyyy HH:mm"));
  
  doc.saveAndClose();
  return doc.getUrl();
}

function saveOrder(obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  sheet.appendRow([new Date(), obj.nota, obj.nama, obj.alamat, obj.no_kamar, obj.berat, obj.layanan, parseInt(obj.harga), "MASUK", obj.jam_selesai, obj.status_bayar, (obj.status_bayar === "Lunas" ? new Date() : ""), "", ""]);
  return true;
}

function savePengeluaran(obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Pengeluaran") || ss.insertSheet("Pengeluaran");
  sheet.appendRow([new Date(), obj.kategori, obj.keterangan, parseInt(obj.jumlah), obj.user]);
  return true;
}

function updateWithChecklist(notaId, statusNew, rincianTeks) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString() == notaId.toString()) {
      sheet.getRange(i + 1, 9).setValue(statusNew); 
      sheet.getRange(i + 1, 14).setValue(rincianTeks); 
      return true;
    }
  }
}

function updateOrderStatus(notaId, statusNew) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString() == notaId.toString()) {
      sheet.getRange(i + 1, 9).setValue(statusNew);
      return true;
    }
  }
}

function updatePaymentStatus(notaId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString() == notaId.toString()) {
      sheet.getRange(i + 1, 11).setValue("Lunas");
      sheet.getRange(i + 1, 12).setValue(new Date());
      return true;
    }
  }
}

function uploadFoto(base64Data, notaId, namaPelanggan) {
  const masterFolder = DriveApp.getFolderById(MASTER_FOLDER_ID);
  let customerFolder;
  const folders = masterFolder.getFoldersByName(namaPelanggan);
  if (folders.hasNext()) customerFolder = folders.next();
  else customerFolder = masterFolder.createFolder(namaPelanggan);
  
  const bytes = Utilities.base64Decode(base64Data.split(",")[1]);
  const blob = Utilities.newBlob(bytes, "image/jpeg", "FOTO_" + notaId + ".jpg");
  customerFolder.createFile(blob);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transaksi");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString() == notaId.toString()) {
      sheet.getRange(i + 1, 13).setValue(customerFolder.getUrl());
      break;
    }
  }
  return true;
}
