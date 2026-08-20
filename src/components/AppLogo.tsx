interface AppLogoProps {
  size?: number
  className?: string
}

export function AppLogo({ size = 32, className }: AppLogoProps): JSX.Element {
  return <img className={className} src="./logo.svg" width={size} height={size} alt="" aria-hidden="true" draggable={false} />
}
