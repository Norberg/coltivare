import { authRedirectUrl } from "../src/authRedirect";

test.each([
  ["http://localhost:5173/#/installningar", "http://localhost:5173"],
  ["http://localhost:5174/?debug=1#/installningar", "http://localhost:5174"],
  ["http://192.168.1.244:5173/", "http://192.168.1.244:5173"],
  [
    "https://norberg.github.io/coltivare/#/installningar",
    "https://norberg.github.io/coltivare/",
  ],
])(
  "login return from %s matches the configured allow-list",
  (address, expected) => {
    expect(authRedirectUrl(address)).toBe(expected);
  },
);
