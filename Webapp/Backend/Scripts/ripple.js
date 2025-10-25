const xrpl = require("xrpl");
(async () => {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();

  const info = await client.request({
    command: "amm_info",
    asset: { currency: "XRP" },
    asset2: {
      currency: "4E56444100000000000000000000000000000000",
      issuer: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4"
    }
  });

  console.log(info.result.amm);

  await client.disconnect();
})();
