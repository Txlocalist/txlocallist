export default function Link({ href, children, prefetch, ...props }) { return <a href={href} {...props}>{children}</a>; }
