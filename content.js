var getCookie = function (name) {
  var value = document.cookie.match("(^|;) ?" + name + "=([^;]*)(;|$)");
  console.log(`document's cookies: ${document.cookie}`);
  console.log(`Cookie name: ${name}, value: ${value}`);
  return value ? value[2] : null;
};
console.log("getCookie okay");
