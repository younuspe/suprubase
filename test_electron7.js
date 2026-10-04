async function test() {
  const electron = await import('electron');
  console.log('electron:', electron);
  console.log('keys:', Object.keys(electron));
  console.log('default:', electron.default);
}
test().catch(console.error);
