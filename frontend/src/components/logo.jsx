const EntityLogo = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <circle cx="100" cy="100" r="18" fill="black" />
    <circle cx="100" cy="45" r="8" fill="black" />
    <circle cx="155" cy="100" r="8" fill="black" />
    <circle cx="100" cy="155" r="8" fill="black" />
    <circle cx="45" cy="100" r="8" fill="black" />
    <circle cx="140" cy="60" r="8" fill="black" />
    <circle cx="60" cy="140" r="8" fill="black" />
    <path
      d="M100 45 L100 82 
         M155 100 L118 100 
         M100 155 L100 118 
         M45 100 L82 100 
         M140 60 L115 85 
         M60 140 L85 115"
      stroke="black"
      strokeWidth="4"
    />
  </svg>
);

export default EntityLogo;
