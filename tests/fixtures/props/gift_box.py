"""A gift box with a hinged lid, in millimetres: the lid turns about the +X top edge, 0-110 degrees."""
import sand3d as s3d


def gift_box(w=240, d=200, h=120, lid_h=36, wall=8):
    base = box_base(w, d, h, wall)
    lid = lid_part(w, d, lid_h)
    top = base.face("+Z")
    hinge = top.move(w / 2)                                  # the +X edge of the open top
    lid = s3d.at(lid, on=top)                                # sits on the rim
    s3d.joint("lid_hinge", lid, hinge, axis="+Y", range=(0, 110))
    return s3d.assembly("gift_box", base, lid)


def box_base(w, d, h, wall):
    base = s3d.box("base", w, d, h)
    s3d.fillet(base, 4, edges="side")
    s3d.pocket(base, s3d.rect(w - 2 * wall, d - 2 * wall), h - wall, on=base.face("+Z"))
    s3d.material(base, "painted_metal", color="#d63a3a")
    return base


def lid_part(w, d, lid_h):
    lid = s3d.box("lid", w + 6, d + 6, lid_h)
    s3d.fillet(lid, 4, edges="side")
    s3d.material(lid, "glossy_plastic", color="#f2e6c9")
    return lid
