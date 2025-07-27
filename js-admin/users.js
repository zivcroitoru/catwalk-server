const rectangle = document.querySelector('.rectangle');

  // Select cat and clothes images inside .category
  const catImage = document.querySelector('.category .cats');
  const clothesImage = document.querySelector('.category .clothes');
const catCount = document.querySelector('.category .cat-count');
  const clothesCount = document.querySelector('.category .clothes-count');

  // Define colors to toggle (you can customize these)
  const catColor = '#ffffffff';      // pinkish for cat
  const clothesColor = '#838e84';  // greenish for clothes
  const defaultColor = '#ffffff';  // original white

  // When clicking the cat image
  catImage.addEventListener('click', () => {
    rectangle.style.backgroundColor = catColor;
  });

  // When clicking the clothes image
  clothesImage.addEventListener('click', () => {
    rectangle.style.backgroundColor = clothesColor;
  });

    clothesCount.addEventListener('click', () => {
    rectangle.style.backgroundColor = clothesColor;
  });

    catCount.addEventListener('click', () => {
    rectangle.style.backgroundColor = catColor;
  });