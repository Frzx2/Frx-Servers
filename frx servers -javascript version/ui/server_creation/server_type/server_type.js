document.addEventListener("DOMContentLoaded", () => {
  const types = document.querySelectorAll(".server-type");
  const label = document.getElementById("selected-label");
  const nextBtn = document.getElementById("next-btn");
  const backBtn = document.getElementById("back-btn");

  let selectedIndex = 0; // default: Vanilla

  function updateSelection(index) {
    types.forEach((type, i) => {
      type.classList.toggle("selected", i === index);
    });

    const selectedType = types[index].dataset.type;
    label.textContent = `Selected: ${selectedType}`;
    selectedIndex = index;
  }

  types.forEach((type, index) => {
    type.addEventListener("click", () => updateSelection(index));
  });

  // default select Vanilla
  updateSelection(selectedIndex);

  nextBtn.addEventListener("click", () => {
    const selectedType = types[selectedIndex].dataset.type;
    localStorage.setItem("selectedServerType", selectedType);
    console.log("Next clicked. Selected Type:", selectedType);
    // navigation logic (Electron or frontend router)
    window.location.href = "../server_version/server_version.html";
  });

  backBtn.addEventListener("click", () => {
    window.location.href = "../../home_screen/home_screen.html";
  });
});
