// To parse this data:
//
//   import { Convert, MyInterface } from "./file";
//
//   const myInterface = Convert.toMyInterface(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface MyInterface {
    basics:   Basics;
    sections: Sections;
    metadata: Metadata;
}

export interface Basics {
    name:         string;
    headline:     string;
    email:        string;
    phone:        string;
    location:     string;
    url:          URL;
    customFields: any[];
    picture:      Picture;
}

export interface Picture {
    url:          string;
    size:         number;
    aspectRatio:  number;
    borderRadius: number;
    effects:      Effects;
}

export interface Effects {
    hidden:    boolean;
    border:    boolean;
    grayscale: boolean;
}

export interface URL {
    label: string;
    href:  string;
}

export interface Metadata {
    template:   string;
    layout:     Array<Array<string[]>>;
    css:        CSS;
    page:       Page;
    theme:      Theme;
    typography: Typography;
    notes:      string;
}

export interface CSS {
    value:   string;
    visible: boolean;
}

export interface Page {
    margin:  number;
    format:  string;
    options: Options;
}

export interface Options {
    breakLine:   boolean;
    pageNumbers: boolean;
}

export interface Theme {
    background: string;
    text:       string;
    primary:    string;
}

export interface Typography {
    font:           Font;
    lineHeight:     number;
    hideIcons:      boolean;
    underlineLinks: boolean;
}

export interface Font {
    family:   string;
    subset:   string;
    variants: string[];
    size:     number;
}

export interface Sections {
    summary:        Awards;
    awards:         Awards;
    certifications: Awards;
    education:      Awards;
    experience:     Awards;
    volunteer:      Awards;
    interests:      Awards;
    languages:      Awards;
    profiles:       Awards;
    projects:       Awards;
    publications:   Awards;
    references:     Awards;
    skills:         Awards;
    custom:         Custom;
}

export interface Awards {
    name:          string;
    columns:       number;
    separateLinks: boolean;
    visible:       boolean;
    id:            string;
    items?:        Item[];
    content?:      string;
}

export interface Item {
    id:           string;
    visible:      boolean;
    name?:        string;
    issuer?:      string;
    date?:        string;
    summary?:     string;
    url?:         URL;
    institution?: string;
    studyType?:   string;
    area?:        string;
    score?:       string;
    company?:     string;
    position?:    string;
    location?:    string;
    keywords?:    any[];
    description?: string;
    level?:       number;
    network?:     string;
    username?:    string;
    icon?:        string;
}

export interface Custom {
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toMyInterface(json: string): MyInterface {
        return cast(JSON.parse(json), r("MyInterface"));
    }

    public static myInterfaceToJson(value: MyInterface): string {
        return JSON.stringify(uncast(value, r("MyInterface")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "MyInterface": o([
        { json: "basics", js: "basics", typ: r("Basics") },
        { json: "sections", js: "sections", typ: r("Sections") },
        { json: "metadata", js: "metadata", typ: r("Metadata") },
    ], false),
    "Basics": o([
        { json: "name", js: "name", typ: "" },
        { json: "headline", js: "headline", typ: "" },
        { json: "email", js: "email", typ: "" },
        { json: "phone", js: "phone", typ: "" },
        { json: "location", js: "location", typ: "" },
        { json: "url", js: "url", typ: r("URL") },
        { json: "customFields", js: "customFields", typ: a("any") },
        { json: "picture", js: "picture", typ: r("Picture") },
    ], false),
    "Picture": o([
        { json: "url", js: "url", typ: "" },
        { json: "size", js: "size", typ: 0 },
        { json: "aspectRatio", js: "aspectRatio", typ: 0 },
        { json: "borderRadius", js: "borderRadius", typ: 0 },
        { json: "effects", js: "effects", typ: r("Effects") },
    ], false),
    "Effects": o([
        { json: "hidden", js: "hidden", typ: true },
        { json: "border", js: "border", typ: true },
        { json: "grayscale", js: "grayscale", typ: true },
    ], false),
    "URL": o([
        { json: "label", js: "label", typ: "" },
        { json: "href", js: "href", typ: "" },
    ], false),
    "Metadata": o([
        { json: "template", js: "template", typ: "" },
        { json: "layout", js: "layout", typ: a(a(a(""))) },
        { json: "css", js: "css", typ: r("CSS") },
        { json: "page", js: "page", typ: r("Page") },
        { json: "theme", js: "theme", typ: r("Theme") },
        { json: "typography", js: "typography", typ: r("Typography") },
        { json: "notes", js: "notes", typ: "" },
    ], false),
    "CSS": o([
        { json: "value", js: "value", typ: "" },
        { json: "visible", js: "visible", typ: true },
    ], false),
    "Page": o([
        { json: "margin", js: "margin", typ: 0 },
        { json: "format", js: "format", typ: "" },
        { json: "options", js: "options", typ: r("Options") },
    ], false),
    "Options": o([
        { json: "breakLine", js: "breakLine", typ: true },
        { json: "pageNumbers", js: "pageNumbers", typ: true },
    ], false),
    "Theme": o([
        { json: "background", js: "background", typ: "" },
        { json: "text", js: "text", typ: "" },
        { json: "primary", js: "primary", typ: "" },
    ], false),
    "Typography": o([
        { json: "font", js: "font", typ: r("Font") },
        { json: "lineHeight", js: "lineHeight", typ: 3.14 },
        { json: "hideIcons", js: "hideIcons", typ: true },
        { json: "underlineLinks", js: "underlineLinks", typ: true },
    ], false),
    "Font": o([
        { json: "family", js: "family", typ: "" },
        { json: "subset", js: "subset", typ: "" },
        { json: "variants", js: "variants", typ: a("") },
        { json: "size", js: "size", typ: 0 },
    ], false),
    "Sections": o([
        { json: "summary", js: "summary", typ: r("Awards") },
        { json: "awards", js: "awards", typ: r("Awards") },
        { json: "certifications", js: "certifications", typ: r("Awards") },
        { json: "education", js: "education", typ: r("Awards") },
        { json: "experience", js: "experience", typ: r("Awards") },
        { json: "volunteer", js: "volunteer", typ: r("Awards") },
        { json: "interests", js: "interests", typ: r("Awards") },
        { json: "languages", js: "languages", typ: r("Awards") },
        { json: "profiles", js: "profiles", typ: r("Awards") },
        { json: "projects", js: "projects", typ: r("Awards") },
        { json: "publications", js: "publications", typ: r("Awards") },
        { json: "references", js: "references", typ: r("Awards") },
        { json: "skills", js: "skills", typ: r("Awards") },
        { json: "custom", js: "custom", typ: r("Custom") },
    ], false),
    "Awards": o([
        { json: "name", js: "name", typ: "" },
        { json: "columns", js: "columns", typ: 0 },
        { json: "separateLinks", js: "separateLinks", typ: true },
        { json: "visible", js: "visible", typ: true },
        { json: "id", js: "id", typ: "" },
        { json: "items", js: "items", typ: u(undefined, a(r("Item"))) },
        { json: "content", js: "content", typ: u(undefined, "") },
    ], false),
    "Item": o([
        { json: "id", js: "id", typ: "" },
        { json: "visible", js: "visible", typ: true },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "issuer", js: "issuer", typ: u(undefined, "") },
        { json: "date", js: "date", typ: u(undefined, "") },
        { json: "summary", js: "summary", typ: u(undefined, "") },
        { json: "url", js: "url", typ: u(undefined, r("URL")) },
        { json: "institution", js: "institution", typ: u(undefined, "") },
        { json: "studyType", js: "studyType", typ: u(undefined, "") },
        { json: "area", js: "area", typ: u(undefined, "") },
        { json: "score", js: "score", typ: u(undefined, "") },
        { json: "company", js: "company", typ: u(undefined, "") },
        { json: "position", js: "position", typ: u(undefined, "") },
        { json: "location", js: "location", typ: u(undefined, "") },
        { json: "keywords", js: "keywords", typ: u(undefined, a("any")) },
        { json: "description", js: "description", typ: u(undefined, "") },
        { json: "level", js: "level", typ: u(undefined, 0) },
        { json: "network", js: "network", typ: u(undefined, "") },
        { json: "username", js: "username", typ: u(undefined, "") },
        { json: "icon", js: "icon", typ: u(undefined, "") },
    ], false),
    "Custom": o([
    ], false),
};
