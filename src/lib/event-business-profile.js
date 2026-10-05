export function getEventBusinessProfileNotice(hasProfile) {
  return hasProfile
    ? {
        title: "Activate Your Business Profile First",
        description: "Your business profile must be active before you can add events to the calendar with your account. Complete and publish your profile, then return to post your event.",
        href: "/dashboard/businesses",
        label: "Go to Your Business Profiles",
      }
    : {
        title: "Create Your Business Profile First",
        description: "Please create and publish your business profile before adding events to the calendar. Once your profile is active, return here to post your event.",
        href: "/dashboard/businesses/new",
        label: "Create Your Business Profile",
      };
}
