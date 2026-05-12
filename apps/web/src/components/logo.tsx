import type * as React from "react";

import logoPng from "@/assets/brand/logo.png";
import logoWebp from "@/assets/brand/logo.webp";
import logoWithNamePng from "@/assets/brand/logo-with-name.png";
import logoWithNameWebp from "@/assets/brand/logo-with-name.webp";

type LogoVariant = "default" | "with-name";

type LogoProps = Omit<
	React.ComponentProps<"img">,
	"src" | "srcSet" | "alt" | "width" | "height"
> & {
	alt?: string;
	variant?: LogoVariant;
};

const logoVariants = {
	default: {
		height: 382,
		png: logoPng,
		webp: logoWebp,
		width: 908,
	},
	"with-name": {
		height: 612,
		png: logoWithNamePng,
		webp: logoWithNameWebp,
		width: 2157,
	},
} as const;

export default function Logo({
	alt = "Modlearn",
	variant = "default",
	...props
}: LogoProps) {
	const asset = logoVariants[variant];

	return (
		<picture>
			<source srcSet={asset.webp} type="image/webp" />
			<img
				alt={alt}
				decoding="async"
				height={asset.height}
				src={asset.png}
				width={asset.width}
				{...props}
			/>
		</picture>
	);
}
