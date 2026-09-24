const QrCode = require("qrcode");

const qrGenerator = async (sku) => {
  const qr = await QrCode.toDataURL(sku);

  console.log(qr);
  return qr;
};

qrGenerator("SPLRC47");

module.exports = qrGenerator;
