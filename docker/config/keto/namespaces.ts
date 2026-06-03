// ORY Permission Language (OPL) namespace definitions
// Compile and load via keto.yml at startup.
// Reference: https://www.ory.sh/docs/keto/reference/ory-permission-language

import { Context, Namespace, SubjectSet, defineNamespace } from "@ory/keto-namespace-types";

class Organization implements Namespace {
  related: {
    admin: User[];
    member: User[];
    viewer: User[];
  };

  permits = {
    // Org admins can do everything
    manage: (ctx: Context): boolean =>
      this.related.admin.includes(ctx.subject),

    // Members and admins can search products
    search: (ctx: Context): boolean =>
      this.related.admin.includes(ctx.subject) ||
      this.related.member.includes(ctx.subject),

    // All roles can read
    read: (ctx: Context): boolean =>
      this.related.admin.includes(ctx.subject) ||
      this.related.member.includes(ctx.subject) ||
      this.related.viewer.includes(ctx.subject),

    // Only admins can seed the database or modify org settings
    seed_database: (ctx: Context): boolean =>
      this.related.admin.includes(ctx.subject),

    invite_members: (ctx: Context): boolean =>
      this.related.admin.includes(ctx.subject),
  };
}

class User implements Namespace {
  related: {
    self: User[];
  };
}

class Resource implements Namespace {
  related: {
    owner: (User | SubjectSet<Organization, "member">)[];
    viewer: (User | SubjectSet<Organization, "member">)[];
  };

  permits = {
    read: (ctx: Context): boolean =>
      this.related.viewer.includes(ctx.subject) ||
      this.related.owner.includes(ctx.subject),
    edit: (ctx: Context): boolean =>
      this.related.owner.includes(ctx.subject),
  };
}
