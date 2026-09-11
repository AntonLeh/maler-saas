import { useEffect } from "react";

type SeoMetaProps = {
  title: string;
  description: string;
  canonical: string;
};

export default function SeoMeta({
  title,
  description,
  canonical,
}: SeoMetaProps) {
  useEffect(() => {
    const descriptionMeta = document.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;

    const canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;

    const robotsMeta = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

    const ogTitle = document.querySelector(
      'meta[property="og:title"]'
    ) as HTMLMetaElement | null;

    const ogDescription = document.querySelector(
      'meta[property="og:description"]'
    ) as HTMLMetaElement | null;

    const ogUrl = document.querySelector(
      'meta[property="og:url"]'
    ) as HTMLMetaElement | null;

    const twitterTitle = document.querySelector(
      'meta[name="twitter:title"]'
    ) as HTMLMetaElement | null;

    const twitterDescription = document.querySelector(
      'meta[name="twitter:description"]'
    ) as HTMLMetaElement | null;

    document.title = title;

    if (descriptionMeta) {
      descriptionMeta.content = description;
    }

    if (canonicalLink) {
      canonicalLink.href = canonical;
    }

    if (robotsMeta) {
      robotsMeta.content = "index, follow";
    }

    if (ogTitle) {
      ogTitle.content = title;
    }

    if (ogDescription) {
      ogDescription.content = description;
    }

    if (ogUrl) {
      ogUrl.content = canonical;
    }

    if (twitterTitle) {
      twitterTitle.content = title;
    }

    if (twitterDescription) {
      twitterDescription.content = description;
    }
  }, [title, description, canonical]);

  return null;
}