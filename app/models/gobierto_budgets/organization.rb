module GobiertoBudgets
  class Organization

    attr_accessor(:id, :place)

    def initialize(attributes)
      if attributes[:slug]
        @place = ::INE::Places::Place.find_by_slug(attributes[:slug])
        if place
          @id = place.id
        else
          @id = attributes[:slug]
          @associated_entity = AssociatedEntity.find_by(entity_id: id)
        end
      elsif attributes[:organization_id]
        @id = attributes[:organization_id]
        @place = ::INE::Places::Place.find(id)
        @associated_entity = AssociatedEntity.find_by(id: id)
      end
    end

    def name
      city_council? ? @place.name : @associated_entity.name
    end

    def slug
      city_council? ? @place.slug : id
    end

    def associated_entities
      city_council? ? AssociatedEntity.by_place(place) : []
    end

    def autonomous_region_name
      if city_council?
        place.province.autonomous_region.name
      else
        associated_entity_place.province.autonomous_region.name
      end
    end

    def province_name
      if city_council?
        place.province.name
      else
        associated_entity_place.province.name
      end
    end

    def parent_place_name
      associated_entity_place.name
    end

    def parent_place_slug
      associated_entity_place.slug
    end

    def city_council?
      @place.present?
    end

    # Meant to be nil for associated entities
    def ine_code
      city_council? ? place.id : nil
    end

    # Meant to return the underlying ine_code
    def place_id
      city_council? ? place.id : associated_entity_place.id
    end

    private

    def associated_entity_place
      ::INE::Places::Place.find(@associated_entity.ine_code) unless city_council?
    end

  end
end
