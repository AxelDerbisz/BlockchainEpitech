const { XummSdk } = require("xumm-sdk");
const xumm = new XummSdk("30c8cd2d-b4db-4f53-973b-5b61ae1d2119", "303c92cc-b95a-47a6-9c4b-2e55504fe3f8");

(async () => {
  const payload = await xumm.payload.create({
    txjson: {
      TransactionType: "Payment",
      Account: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4",
      Destination: "rJghfWPywJGinu8YVGzjkYDJuqCUZX4ZAo",
      Amount: {
        currency: "4E56444100000000000000000000000000000000",
        issuer: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4",
        value: "10"
      }
    },
    custom_meta: {
      name: "Manual Mint Test",
      instruction: "Sign to issue 10 NVDA to recipient"
    },
    options: { submit: true }
  });

  console.log(payload.next.always);
})();
