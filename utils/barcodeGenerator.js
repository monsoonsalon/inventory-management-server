const bwipjs = require("bwip-js");

// Computes the EAN-13 check digit for a 12-digit code
const ean13CheckDigit = (digits12) => {
  const sum = digits12
    .split("")
    .reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);

  return (10 - (sum % 10)) % 10;
};

// Validates/normalizes an EAN code
const toEan13 = (eanCode) => {
  const digitsOnly = String(eanCode).trim();

  if (!/^\d{12,13}$/.test(digitsOnly)) {
    throw new Error(`Invalid EAN code "${eanCode}": must be 12 or 13 digits`);
  }

  const base12 = digitsOnly.slice(0, 12);
  const checkDigit = ean13CheckDigit(base12);

  if (digitsOnly.length === 13 && Number(digitsOnly[12]) !== checkDigit) {
    throw new Error(`Invalid EAN-13 code "${eanCode}": check digit mismatch`);
  }

  return base12 + checkDigit;
};

const barcodeGenerator = async (eanCode) => {
  const ean = toEan13(eanCode);

  const png = await bwipjs.toBuffer({
    bcid: "ean13",
    text: ean,
    scale: 5,
    height: 20,
    includetext: true,
    textxalign: "center",
  });

  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  return dataUrl;
};

module.exports = barcodeGenerator;
module.exports.toEan13 = toEan13;

// TEST FROM TERMINAL
barcodeGenerator("400638133393")
  .then((dataUrl) => {
    console.log("Barcode generated");
    console.log("EAN:", toEan13("400638133393"));
    console.log(dataUrl);
  })
  .catch((error) => {
    console.error(error);
  });
