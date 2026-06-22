import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
  isDark: false,
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  const [isDark, setIsDark] = useState(false);

  const setTheme = (newTheme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      let activeDark = false;
      if (theme === "dark") {
        activeDark = true;
      } else if (theme === "light") {
        activeDark = false;
      } else {
        // System preference
        activeDark = mediaQuery.matches;
      }

      if (activeDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      setIsDark(activeDark);
    };

    applyTheme();

    // Listen for system theme updates
    const handleChange = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
