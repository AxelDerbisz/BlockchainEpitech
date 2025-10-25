await withClient(async (client) => {
  const issuer = getIssuerWallet();
  const response = await client.request({
    command: "account_lines",
    account: "YOUR_ADDRESS",
    peer: issuer.classicAddress,
  });
  console.log(JSON.stringify(response.result.lines, null, 2));
});
